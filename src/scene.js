import { DEG, BETA_MIN, BETA_MAX, tripleAt } from './physics.js';
import { el, clear, text, forceParts, COLORS, clientToSvg } from './svg.js';

// --- geometry -------------------------------------------------------------
// Every constant below was fixed by the sweep in test/scene.test.js, which
// walks the whole beta range checking crate clearance and viewBox containment.
// Change one and re-run that test before believing the result.
export const SCENE_VB = { w: 720, h: 680 };
export const CEIL_Y = 44;
export const ANCHOR_D = { x: 140, y: CEIL_Y };
export const ROPE_BD_LEN = 230;
export const GROUND_Y = 635;
export const CRATE = { w: 88, h: 78, drop: 250 };
export const ANCHOR_R = 15;

// The pulley hangs from the fixed ceiling anchor on a fixed-length rope, so its position
// is DERIVED from theta: it swings as the ground anchor moves. This is why there is no
// PULLEY constant any more.
export function pulleyAt(theta) {
  const t = theta * DEG;
  return { x: ANCHOR_D.x + ROPE_BD_LEN * Math.cos(t),
           y: ANCHOR_D.y + ROPE_BD_LEN * Math.sin(t) };
}

// C slides along the ground, so its x alone fixes beta, given where the pulley is.
export function anchorC(beta) {
  const b = pulleyAt(45 + beta / 2);
  return { x: b.x + (GROUND_Y - b.y) / Math.tan(beta * DEG), y: GROUND_Y };
}

// x of rope BC at height y -- used by the sweep to prove the rope clears the crate.
export function ropeBcXAt(beta, y) {
  const b = pulleyAt(45 + beta / 2);
  const c = anchorC(beta);
  return b.x + (y - b.y) / (GROUND_Y - b.y) * (c.x - b.x);
}

// The pulley's position depends on beta and beta depends on the pulley's position, so a
// drag must SOLVE rather than compute. f(beta) = observedBeta(beta) - beta is strictly
// decreasing across the range, so bisection finds the unique root.
export function betaFromPointerX(px) {
  const f = (beta) => {
    const b = pulleyAt(45 + beta / 2);
    return Math.atan2(GROUND_Y - b.y, px - b.x) / DEG - beta;
  };
  let lo = BETA_MIN, hi = BETA_MAX;
  if (f(lo) < 0) return lo;
  if (f(hi) > 0) return hi;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (f(m) > 0) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

// The keyboard steps the ANGLE, never the anchor's x. It rounds before stepping so
// whole-degree presses stay on a uniform grid after leaving the detent, and skips the
// rounding under Shift so fine adjustment is possible.
export function keyboardStep(now, delta, shiftKey) {
  const base = shiftKey ? now : Math.round(now);
  return base + delta;
}

// The slope-triangle glyph: the construction the textbook figure uses, drawn only when
// the rope sits exactly on one of the four Pythagorean-triple detents. Pure and exported
// so its geometry can be asserted without a DOM; the renderer below just draws it.
//
// k scales the triple so the hypotenuse is always 46px. P0 is the top vertex; P1 is
// straight down from P0 (the "down" leg); P2 is right of P1 (the "across" leg), so the
// hypotenuse P0->P2 is parallel to the rope by construction (tan beta = down/across).
// It is placed 0.70 of the way from the pulley to anchor C, offset outward along the
// rope's normal -- load-bearing: at 0.50/0.60 the glyph collides with the T_BC label at
// every detent; 0.70 clears it by at least 20px.
export function slopeGlyph(beta) {
  const t = tripleAt(beta);
  if (!t) return null;
  const b = pulleyAt(45 + beta / 2);
  const c = anchorC(beta);
  const mid = { x: b.x + 0.70 * (c.x - b.x), y: b.y + 0.70 * (c.y - b.y) };
  const n = { x: Math.sin(beta * DEG), y: -Math.cos(beta * DEG) };
  const k = 46 / t.hyp;
  const p0 = { x: mid.x + n.x * 30 - (t.across * k) / 2, y: mid.y + n.y * 30 - (t.down * k) / 2 };
  const p1 = { x: p0.x, y: p0.y + t.down * k };
  const p2 = { x: p1.x + t.across * k, y: p1.y };
  return { p0, p1, p2, triple: t };
}

// The angle between the two LOADED rope segments (BA straight down, BC toward the
// anchor), and the angle the support rope makes with vertical. The second is always
// exactly half the first: that is the bisector property this whole app is about,
// and T_BD = 2W*cos(delta) uses delta directly.
export function interiorAngles(s) {
  return { gamma: 90 - s.beta, delta: 90 - s.theta };
}

// --- annotation geometry ---------------------------------------------------
// theta is measured from the ray running LEFT from the pulley and beta from the ray
// running RIGHT, so until this line existed both arcs closed on nothing. One dotted
// construction line through B supplies both rays. Its half-length has to outrun the
// outer arc (beta's, at 75) and still stay inside the panel at every beta; the sweep
// in scene.test.js pins both ends of that.
export const HORIZ_REF_HALF = 100;
export function horizontalRef(pulley) {
  return { x1: pulley.x - HORIZ_REF_HALF, y1: pulley.y,
           x2: pulley.x + HORIZ_REF_HALF, y2: pulley.y };
}

// delta is read at D, where the support rope meets the ceiling, against a vertical
// dropped from the anchor -- the same angle as at the pulley (90 - theta), since the
// vertical at D and the vertical at B are parallel. The drop has to outrun DELTA_R
// so the arc always lands on it.
export const VERT_REF_LEN = 78;
export const DELTA_R = 60;
export const GAMMA_R = 46;

// Neither wedge is ever wide enough to letter inside. At beta = 77 deg the gamma
// wedge (crate rope to BC) clears only 56.1px before the crate blocks it, and the
// delta wedge at D only 26.1px at its widest -- against labels measured in the
// browser at 57.7px and 55.9px, before either one is given any clearance. So the arc
// stays in the wedge, where it belongs, and the number sits just outside the vertical
// ray bounding that wedge, tied back by a leader: ordinary drafting practice for an
// angle too tight to letter inside. Both leaders start ON their own arc, at the
// wedge's mid-angle, and run left to a label anchored at its end.
function leaderLabel(center, r, midDeg) {
  const from = { x: center.x + r * Math.cos(midDeg * DEG),
                 y: center.y + r * Math.sin(midDeg * DEG) };
  return { from, to: { x: center.x - 10, y: from.y },
           at: { x: center.x - 14, y: from.y + 4 } };
}

// gamma's wedge runs from the crate's rope (straight down, 90 deg below horizontal)
// to BC (beta below horizontal), centred on the pulley; delta's runs from the vertical
// at D to the rope DB (theta below horizontal), centred on ANCHOR_D.
export function gammaLeader(s) {
  return leaderLabel(pulleyAt(s.theta), GAMMA_R, (90 + s.beta) / 2);
}
export function deltaLeader(s) {
  return leaderLabel(ANCHOR_D, DELTA_R, (90 + s.theta) / 2);
}

// Pure, so a test can check it against fbdLabels/triangleLabels/terms without
// a DOM. render() below must build its force labels only from this function,
// never inline, so the scene can never drift from what the other panels say.
export function sceneLabels(s) {
  return {
    tba: forceParts('BA', Math.round(s.TBA)),
    tbc: forceParts('BC', Math.round(s.TBC)),
    tbd: forceParts('BD', Math.round(s.TBD))
  };
}

// --- drawing --------------------------------------------------------------
export function createScene(svg, actions) {
  const drawRoot = el('g', {}, svg);
  const handleRoot = el('g', {}, svg);
  let latest = null;

  const cHandle = el('g', {
    class: 'handle', tabindex: '0', role: 'slider', 'data-scene': 'c'
  }, handleRoot);
  el('circle', { class: 'hit', r: 22, fill: 'transparent' }, cHandle);
  el('circle', { r: 8, fill: '#fff', stroke: COLORS.t2, 'stroke-width': 3 }, cHandle);

  // `dash` null draws a solid arc. gamma's and delta's arcs use that: they subtend
  // 13-46 deg and 6.5-23 deg, so at their radii they are only 10-37px and 7-24px
  // long, and a '4 3' pattern renders the shortest of them as a single dash. Solid
  // also separates them at a glance from the dashed, coloured theta/beta arcs --
  // grey solid reads as the derived interior angle, dashed colour as the angle
  // measured off the horizontal construction line.
  function arc(parent, center, r, a0, a1, color, dash = '4 3') {
    const p0 = { x: center.x + r * Math.cos(a0 * DEG), y: center.y - r * Math.sin(a0 * DEG) };
    const p1 = { x: center.x + r * Math.cos(a1 * DEG), y: center.y - r * Math.sin(a1 * DEG) };
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    const sweep = a1 > a0 ? 0 : 1;
    el('path', {
      d: `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} ${sweep} ${p1.x} ${p1.y}`,
      fill: 'none', stroke: color, 'stroke-width': 1.5, 'stroke-dasharray': dash
    }, parent);
  }

  function render(s) {
    latest = s;
    clear(drawRoot);
    const pulley = pulleyAt(s.theta);
    const C = anchorC(s.beta);
    const crateTop = pulley.y + CRATE.drop;

    // ground
    el('line', { x1: 40, y1: GROUND_Y, x2: SCENE_VB.w - 30, y2: GROUND_Y,
                 stroke: COLORS.ink, 'stroke-width': 3 }, drawRoot);

    // the ceiling: a fixed horizontal structure, not a rotating stub. ANCHOR_D sits on
    // it and never moves; the pulley is what swings now. Hatch ticks above the line
    // read as solid structure rather than another rope.
    el('line', { x1: 40, y1: CEIL_Y, x2: 330, y2: CEIL_Y,
                 stroke: COLORS.ink, 'stroke-width': 5 }, drawRoot);
    const HATCH_N = 10;
    for (let i = 0; i <= HATCH_N; i++) {
      const hx = 40 + (330 - 40) * i / HATCH_N;
      el('line', { x1: hx, y1: CEIL_Y, x2: hx - 10, y2: CEIL_Y - 12,
                   stroke: COLORS.ink, 'stroke-width': 2 }, drawRoot);
    }

    // ropes
    el('line', { x1: ANCHOR_D.x, y1: ANCHOR_D.y, x2: pulley.x, y2: pulley.y,
                 stroke: COLORS.t1, 'stroke-width': 4 }, drawRoot);
    el('line', { x1: pulley.x, y1: pulley.y, x2: pulley.x, y2: crateTop,
                 stroke: COLORS.w, 'stroke-width': 4 }, drawRoot);
    el('line', { x1: pulley.x, y1: pulley.y, x2: C.x, y2: C.y,
                 stroke: COLORS.t2, 'stroke-width': 4 }, drawRoot);

    // the horizontal through B that theta and beta are both measured from: theta
    // opens off the ray running left, beta off the ray running right. Drawn here
    // rather than later so the pulley disc, which comes after, masks the stretch
    // that would otherwise run across the sheave.
    const href = horizontalRef(pulley);
    el('line', { x1: href.x1, y1: href.y1, x2: href.x2, y2: href.y2,
                 stroke: COLORS.annot, 'stroke-width': 1.5,
                 'stroke-dasharray': '1 5', 'stroke-linecap': 'round' }, drawRoot);

    // angle arcs, both drawn at the pulley so they move with it, opening in opposite
    // directions off that horizontal so the bisector relationship is visible
    arc(drawRoot, pulley, 55, 180, 180 - s.theta, COLORS.t1);
    arc(drawRoot, pulley, 75, 0, -s.beta, COLORS.t2);

    // gamma (interior angle BA-BC, at the pulley) and delta (the support rope's angle
    // from vertical, read at the ceiling anchor D) -- the bisector property the whole
    // app teaches: delta is always exactly gamma/2. Both in the muted annotation ink so
    // they read as measurement, not rope. delta needs an explicit vertical to measure
    // against, dropped from D; gamma needs none, since the crate's rope B-A already
    // IS the vertical-down ray of its wedge.
    el('line', { x1: ANCHOR_D.x, y1: ANCHOR_D.y,
                 x2: ANCHOR_D.x, y2: ANCHOR_D.y + VERT_REF_LEN,
                 stroke: COLORS.annot, 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }, drawRoot);
    arc(drawRoot, ANCHOR_D, DELTA_R, -90, -s.theta, COLORS.annot, null);
    arc(drawRoot, pulley, GAMMA_R, -90, -s.beta, COLORS.annot, null);

    // crate
    const cx = pulley.x - CRATE.w / 2;
    el('rect', { x: cx, y: crateTop, width: CRATE.w, height: CRATE.h, rx: 4,
                 fill: '#d8d2bb', stroke: COLORS.ink, 'stroke-width': 3 }, drawRoot);
    el('line', { x1: cx, y1: crateTop, x2: cx + CRATE.w, y2: crateTop + CRATE.h,
                 stroke: COLORS.ink, 'stroke-width': 1.5 }, drawRoot);
    el('line', { x1: cx + CRATE.w, y1: crateTop, x2: cx, y2: crateTop + CRATE.h,
                 stroke: COLORS.ink, 'stroke-width': 1.5 }, drawRoot);

    // the pulley itself, drawn over the ropes
    el('circle', { cx: pulley.x, cy: pulley.y, r: 15, fill: '#dbe7f3',
                   stroke: COLORS.ink, 'stroke-width': 3 }, drawRoot);
    el('circle', { cx: pulley.x, cy: pulley.y, r: 4, fill: COLORS.ink }, drawRoot);

    // the fixed ceiling anchor at D, drawn as the same small ring used for anchor C
    el('circle', { cx: ANCHOR_D.x, cy: ANCHOR_D.y, r: 7, fill: '#fff',
                   stroke: COLORS.ink, 'stroke-width': 3 }, drawRoot);

    // ground anchor at C, drawn under the handle
    el('circle', { cx: C.x, cy: C.y, r: 7, fill: '#fff',
                   stroke: COLORS.ink, 'stroke-width': 3 }, drawRoot);

    // the slope-triangle glyph -- the textbook construction -- only when the rope is
    // exactly on one of the four Pythagorean-triple detents
    const glyph = slopeGlyph(s.beta);
    if (glyph) {
      const { p0, p1, p2, triple } = glyph;
      el('line', { x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y,
                   stroke: COLORS.ink, 'stroke-width': 2 }, drawRoot);
      el('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
                   stroke: COLORS.ink, 'stroke-width': 2 }, drawRoot);
      el('line', { x1: p0.x, y1: p0.y, x2: p2.x, y2: p2.y,
                   stroke: COLORS.ink, 'stroke-width': 2 }, drawRoot);
      // "down" just left of P0-P1
      text(drawRoot, p0.x - 6, (p0.y + p1.y) / 2 + 4, String(triple.down),
           { size: 12, weight: 600, anchor: 'end' });
      // "across" just below P1-P2
      text(drawRoot, (p1.x + p2.x) / 2, p1.y + 16, String(triple.across),
           { size: 12, weight: 600, anchor: 'middle' });
      // "hyp" just outside the hypotenuse P0-P2 -- offset perpendicular to it, away
      // from the right-angle vertex P1 (same technique triangle.js uses for its legs)
      const hx = p2.x - p0.x, hy = p2.y - p0.y;
      const hlen = Math.hypot(hx, hy) || 1;
      let hnx = -hy / hlen, hny = hx / hlen;
      const hmx = (p0.x + p2.x) / 2, hmy = (p0.y + p2.y) / 2;
      if (hnx * (hmx - p1.x) + hny * (hmy - p1.y) < 0) { hnx = -hnx; hny = -hny; }
      text(drawRoot, hmx + hnx * 14, hmy + hny * 14 + 4, String(triple.hyp),
           { size: 12, weight: 600, anchor: 'middle' });
    }

    // labels
    text(drawRoot, ANCHOR_D.x - 10, ANCHOR_D.y + 24, 'D', { weight: 600, anchor: 'end' });
    text(drawRoot, pulley.x + 22, pulley.y - 12, 'B', { weight: 600 });
    text(drawRoot, pulley.x - CRATE.w / 2 - 10, crateTop + 22, 'A', { weight: 600, anchor: 'end' });
    text(drawRoot, C.x + 4, C.y + 26, 'C', { weight: 600 });

    text(drawRoot, pulley.x - 78, pulley.y - 46, `θ = ${s.theta.toFixed(1)}°`,
         { fill: COLORS.t1, weight: 600, anchor: 'end' });
    text(drawRoot, pulley.x + 92, pulley.y + 58, `β = ${s.beta.toFixed(1)}°`,
         { fill: COLORS.t2, weight: 600 });

    // gamma's and delta's values. The arc sits in the wedge it measures; the number
    // cannot -- see leaderLabel above for the measured widths -- so it sits just
    // outside the vertical ray bounding that wedge, with a leader running back to
    // the arc. Both are drawn after the ropes so the leader crossing the crate's
    // rope reads as an annotation on top of it.
    const angles = interiorAngles(s);
    const annots = [
      [gammaLeader(s), `\u03b3 = ${angles.gamma.toFixed(1)}\u00b0`],
      [deltaLeader(s), `\u03b4 = ${angles.delta.toFixed(1)}\u00b0`]
    ];
    for (const [leader, label] of annots) {
      el('line', { x1: leader.from.x, y1: leader.from.y, x2: leader.to.x, y2: leader.to.y,
                   stroke: COLORS.annot, 'stroke-width': 1.2 }, drawRoot);
      text(drawRoot, leader.at.x, leader.at.y, label,
           { fill: COLORS.annot, weight: 600, anchor: 'end' });
    }

    const labels = sceneLabels(s);
    const dm = { x: (ANCHOR_D.x + pulley.x) / 2, y: (ANCHOR_D.y + pulley.y) / 2 };
    text(drawRoot, dm.x - 14, dm.y, labels.tbd,
         { fill: COLORS.t1, weight: 600, anchor: 'end' });
    text(drawRoot, pulley.x - 14, (pulley.y + crateTop) / 2, labels.tba,
         { fill: COLORS.w, weight: 600, anchor: 'end' });
    const cm = { x: (pulley.x + C.x) / 2, y: (pulley.y + C.y) / 2 };
    text(drawRoot, cm.x + 14, cm.y, labels.tbc,
         { fill: COLORS.t2, weight: 600 });
    text(drawRoot, pulley.x, crateTop + CRATE.h / 2 + 5, `W = ${Math.round(s.W)} N`,
         { anchor: 'middle', weight: 600 });

    cHandle.setAttribute('transform', `translate(${C.x} ${C.y})`);
    cHandle.setAttribute('aria-valuenow', s.beta.toFixed(2));
    cHandle.setAttribute('aria-valuemin', String(BETA_MIN));
    cHandle.setAttribute('aria-valuemax', String(BETA_MAX));
    cHandle.setAttribute('aria-label', 'Ground anchor position');
    const atLimit = Math.abs(s.beta - BETA_MIN) < 1e-9 || Math.abs(s.beta - BETA_MAX) < 1e-9;
    cHandle.classList.toggle('handle--limit', atLimit);
  }

  // Same shape as fbd.js's setActive: this panel has one handle instead of
  // fbd's three, so it takes a boolean rather than a key to match against.
  function setActive(on) {
    cHandle.classList.toggle('handle--active', on);
  }

  let dragging = false;
  let dragPointerId = null;

  svg.addEventListener('pointerover', e => {
    const g = e.target.closest('[data-scene]');
    if (g && !dragging) setActive(true);
  });
  svg.addEventListener('pointerout', () => { if (!dragging) setActive(false); });
  handleRoot.addEventListener('focusin', e => {
    const g = e.target.closest('[data-scene]');
    if (g) setActive(true);
  });
  handleRoot.addEventListener('focusout', () => { if (!dragging) setActive(false); });

  svg.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;                 // right/middle click must not drag
    const g = e.target.closest('[data-scene]');
    if (!g) return;
    // Only start the drag once capture has actually succeeded. A pointerup
    // outside the svg only reaches endDrag if capture is held, so latching
    // `dragging` before this call could leave a drag live but uncaptured.
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      return;                 // capture failed: do not start a drag we cannot end
    }
    dragging = true;
    dragPointerId = e.pointerId;
    g.focus();
    setActive(true);
    e.preventDefault();
  });

  svg.addEventListener('pointermove', e => {
    if (!dragging || !latest || e.pointerId !== dragPointerId) return;
    const p = clientToSvg(svg, e.clientX, e.clientY);
    actions.setBeta(betaFromPointerX(p.x));     // pointer path: snaps at the detent
  });

  function endDrag(e) {
    if (!dragging || e.pointerId !== dragPointerId) return;
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    dragging = false;
    dragPointerId = null;
    const focused = document.activeElement && document.activeElement.closest
      ? document.activeElement.closest('[data-scene]') : null;
    setActive(!!focused);
  }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  handleRoot.addEventListener('keydown', e => {
    if (!e.target.closest('[data-scene]')) return;
    const step = e.shiftKey ? 0.1 : 1;
    let delta = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') delta = step;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') delta = -step;
    else return;
    e.preventDefault();
    // Use the exact setter so a whole-degree press never re-snaps into the detent.
    const now = latest ? latest.beta : 0;
    actions.setBetaExact(keyboardStep(now, delta, e.shiftKey));
  });

  return { render };
}
