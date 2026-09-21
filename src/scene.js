import { DEG, BETA_MIN, BETA_MAX, tripleAt } from './physics.js';
import { el, clear, text, COLORS, clientToSvg } from './svg.js';

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

// Pure, so a test can check it against fbdLabels/triangleLabels/terms without
// a DOM. render() below must build its force labels only from this function,
// never inline, so the scene can never drift from what the other panels say.
export function sceneLabels(s) {
  return {
    tab: `T_AB = ${Math.round(s.TAB)} N`,
    tbc: `T_BC = ${Math.round(s.TBC)} N`,
    tbd: `T_BD = ${Math.round(s.TBD)} N`
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

  function arc(parent, center, r, a0, a1, color) {
    const p0 = { x: center.x + r * Math.cos(a0 * DEG), y: center.y - r * Math.sin(a0 * DEG) };
    const p1 = { x: center.x + r * Math.cos(a1 * DEG), y: center.y - r * Math.sin(a1 * DEG) };
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    const sweep = a1 > a0 ? 0 : 1;
    el('path', {
      d: `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} ${sweep} ${p1.x} ${p1.y}`,
      fill: 'none', stroke: color, 'stroke-width': 1.5, 'stroke-dasharray': '4 3'
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

    // angle arcs, both drawn at the pulley so they move with it, opening in opposite
    // directions so the bisector relationship between them is visible
    arc(drawRoot, pulley, 55, 180, 180 - s.theta, COLORS.t1);
    arc(drawRoot, pulley, 75, 0, -s.beta, COLORS.t2);

    // gamma (interior angle BA-BC) and delta (angle of BD from vertical) -- the
    // bisector property the whole app teaches: delta is always exactly gamma/2.
    // Both are drawn in the muted annotation ink so they read as measurement, not
    // rope. delta's arc shares its BD ray with the theta arc; gamma's shares its BC
    // ray with the beta arc -- radii 38 and 46 keep all four arcs visually distinct
    // (theta=55, beta=75). delta needs an explicit vertical reference (drawn here as
    // a short dashed line rising from B) since "vertical" isn't otherwise drawn at B;
    // gamma needs none -- the crate's rope A-B is already the vertical-down ray.
    el('line', { x1: pulley.x, y1: pulley.y, x2: pulley.x, y2: pulley.y - 50,
                 stroke: COLORS.annot, 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }, drawRoot);
    arc(drawRoot, pulley, 38, 90, 180 - s.theta, COLORS.annot);
    arc(drawRoot, pulley, 46, -90, -s.beta, COLORS.annot);

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

    // gamma/delta labels -- placed OUTSIDE their own wedges, beside the arc,
    // rather than at the arc's midpoint angle (the previous approach, which put
    // the label INSIDE the wedge it measures). Both wedges are too narrow for a
    // ~66px label across the reachable range -- delta (vertical-to-BD) is only
    // 6.5-23 deg wide, gamma (crate-rope-to-BC) only 13-46 deg wide -- so a label
    // centred in either one always crossed a bounding ray; that was the bug
    // (measured, before this fix: gamma and delta both had 0px rope clearance at
    // beta=44, vs. 48.9px/20.1px for theta/beta). The dashed arc still shows which
    // angle is meant; putting the number beside it instead of inside it is
    // ordinary technical-drawing practice when a wedge is too tight for its text.
    //
    // Both offsets are FIXED relative to the (moving) pulley -- the same
    // technique theta/beta's value labels above already use, not an
    // arc-midpoint formula -- placed in the open area up and to the right of the
    // pulley where no rope ever runs (BD occupies up-left, the crate rope
    // straight down, BC down-right). Gamma sits just above horizontal (outside
    // its own wedge, which occupies the area from straight-down to the BC rope);
    // delta sits further up and to the right (outside its wedge, which occupies
    // the area from straight-up to the BD rope). Chosen by sweeping a numeric
    // proxy for every label/rope bounding box across the whole beta range at
    // several weights and detents (see lab_notebook.md), not by eye -- worst
    // measured clearance in that proxy is ~40px against every rope and every
    // other label, well clear of the 15px/12px minimums the existing theta/beta
    // labels themselves meet.
    const angles = interiorAngles(s);
    const GAMMA_LABEL = { angle: -2, radius: 75 };
    const DELTA_LABEL = { angle: 63, radius: 75 };
    text(drawRoot, pulley.x + GAMMA_LABEL.radius * Math.cos(GAMMA_LABEL.angle * DEG),
         pulley.y - GAMMA_LABEL.radius * Math.sin(GAMMA_LABEL.angle * DEG), `γ = ${angles.gamma.toFixed(1)}°`,
         { fill: COLORS.annot, weight: 600, anchor: 'start' });
    text(drawRoot, pulley.x + DELTA_LABEL.radius * Math.cos(DELTA_LABEL.angle * DEG),
         pulley.y - DELTA_LABEL.radius * Math.sin(DELTA_LABEL.angle * DEG), `δ = ${angles.delta.toFixed(1)}°`,
         { fill: COLORS.annot, weight: 600, anchor: 'start' });

    const labels = sceneLabels(s);
    const dm = { x: (ANCHOR_D.x + pulley.x) / 2, y: (ANCHOR_D.y + pulley.y) / 2 };
    text(drawRoot, dm.x - 14, dm.y, labels.tbd,
         { fill: COLORS.t1, weight: 600, anchor: 'end' });
    text(drawRoot, pulley.x - 14, (pulley.y + crateTop) / 2, labels.tab,
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
