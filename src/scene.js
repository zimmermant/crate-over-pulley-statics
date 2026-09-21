import { DEG, BETA_MIN, BETA_MAX, BETA_SPECIAL } from './physics.js';
import { el, clear, text, COLORS, clientToSvg } from './svg.js';

// --- geometry -------------------------------------------------------------
// Every constant below was fixed by the sweep in test/scene.test.js, which
// walks the whole beta range checking crate clearance and viewBox containment.
// Change one and re-run that test before believing the result.
export const SCENE_VB = { w: 720, h: 620 };
export const PULLEY = { x: 185, y: 195 };
export const GROUND_Y = 560;
export const DROP = GROUND_Y - PULLEY.y;
export const CRATE = { w: 96, h: 80, top: 430 };
export const ROPE_BD_LEN = 155;
export const ANCHOR_R = 15;

// C slides along the ground, so its x alone fixes beta.
export function anchorC(beta) {
  return { x: PULLEY.x + DROP / Math.tan(beta * DEG), y: GROUND_Y };
}

// D rides around on a fixed-length rope so the pulley -- the free body -- can
// stay put while theta changes. Its wall stub rotates to match.
export function anchorD(theta) {
  return {
    x: PULLEY.x - ROPE_BD_LEN * Math.cos(theta * DEG),
    y: PULLEY.y - ROPE_BD_LEN * Math.sin(theta * DEG)
  };
}

export function betaFromPointerX(px) {
  const run = Math.max(px - PULLEY.x, 1e-9);
  return Math.atan2(DROP, run) / DEG;
}

// The keyboard steps the ANGLE, never the anchor's x. It rounds before stepping so
// whole-degree presses stay on a uniform grid after leaving the detent, and skips the
// rounding under Shift so fine adjustment is possible.
export function keyboardStep(now, delta, shiftKey) {
  const base = shiftKey ? now : Math.round(now);
  return base + delta;
}

// x of rope BC at height y, used by the sweep to prove the rope clears the crate.
export function ropeBcXAt(beta, y) {
  return PULLEY.x + (y - PULLEY.y) / DROP * (anchorC(beta).x - PULLEY.x);
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

  function arc(parent, r, a0, a1, color) {
    const p0 = { x: PULLEY.x + r * Math.cos(a0 * DEG), y: PULLEY.y - r * Math.sin(a0 * DEG) };
    const p1 = { x: PULLEY.x + r * Math.cos(a1 * DEG), y: PULLEY.y - r * Math.sin(a1 * DEG) };
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
    const C = anchorC(s.beta);
    const D = anchorD(s.theta);

    // ground
    el('line', { x1: 40, y1: GROUND_Y, x2: SCENE_VB.w - 30, y2: GROUND_Y,
                 stroke: COLORS.ink, 'stroke-width': 3 }, drawRoot);

    // the support rope's wall stub, perpendicular to the rope
    const nx = Math.sin(s.theta * DEG), ny = Math.cos(s.theta * DEG);
    el('line', { x1: D.x - 26 * nx, y1: D.y - 26 * ny, x2: D.x + 26 * nx, y2: D.y + 26 * ny,
                 stroke: COLORS.ink, 'stroke-width': 5 }, drawRoot);

    // ropes
    el('line', { x1: D.x, y1: D.y, x2: PULLEY.x, y2: PULLEY.y,
                 stroke: COLORS.t1, 'stroke-width': 4 }, drawRoot);
    el('line', { x1: PULLEY.x, y1: PULLEY.y, x2: PULLEY.x, y2: CRATE.top,
                 stroke: COLORS.w, 'stroke-width': 4 }, drawRoot);
    el('line', { x1: PULLEY.x, y1: PULLEY.y, x2: C.x, y2: C.y,
                 stroke: COLORS.t2, 'stroke-width': 4 }, drawRoot);

    // angle arcs, both at the free body, opening in opposite directions so the
    // bisector relationship between them is visible
    arc(drawRoot, 55, 180, 180 - s.theta, COLORS.t1);
    arc(drawRoot, 75, 0, -s.beta, COLORS.t2);

    // crate
    const cx = PULLEY.x - CRATE.w / 2;
    el('rect', { x: cx, y: CRATE.top, width: CRATE.w, height: CRATE.h, rx: 4,
                 fill: '#d8d2bb', stroke: COLORS.ink, 'stroke-width': 3 }, drawRoot);
    el('line', { x1: cx, y1: CRATE.top, x2: cx + CRATE.w, y2: CRATE.top + CRATE.h,
                 stroke: COLORS.ink, 'stroke-width': 1.5 }, drawRoot);
    el('line', { x1: cx + CRATE.w, y1: CRATE.top, x2: cx, y2: CRATE.top + CRATE.h,
                 stroke: COLORS.ink, 'stroke-width': 1.5 }, drawRoot);

    // the pulley itself, drawn over the ropes
    el('circle', { cx: PULLEY.x, cy: PULLEY.y, r: 15, fill: '#dbe7f3',
                   stroke: COLORS.ink, 'stroke-width': 3 }, drawRoot);
    el('circle', { cx: PULLEY.x, cy: PULLEY.y, r: 4, fill: COLORS.ink }, drawRoot);

    // ground anchor at C, drawn under the handle
    el('circle', { cx: C.x, cy: C.y, r: 7, fill: '#fff',
                   stroke: COLORS.ink, 'stroke-width': 3 }, drawRoot);

    // labels
    text(drawRoot, D.x - 22, D.y - 6, 'D', { weight: 600, anchor: 'end' });
    text(drawRoot, PULLEY.x + 22, PULLEY.y - 12, 'B', { weight: 600 });
    text(drawRoot, PULLEY.x - CRATE.w / 2 - 10, CRATE.top + 22, 'A', { weight: 600, anchor: 'end' });
    text(drawRoot, C.x + 4, C.y + 26, 'C', { weight: 600 });

    text(drawRoot, PULLEY.x - 78, PULLEY.y - 46, `θ = ${s.theta.toFixed(1)}°`,
         { fill: COLORS.t1, weight: 600, anchor: 'end' });
    // The detent marker Todd chose: naming the textbook slope when you're on it.
    const atDetent = Math.abs(s.beta - BETA_SPECIAL) < 1e-9;
    const betaText = atDetent ? `β = ${s.beta.toFixed(1)}° (12-13-5)` : `β = ${s.beta.toFixed(1)}°`;
    text(drawRoot, PULLEY.x + 92, PULLEY.y + 58, betaText,
         { fill: COLORS.t2, weight: 600 });

    const labels = sceneLabels(s);
    const dm = { x: (D.x + PULLEY.x) / 2, y: (D.y + PULLEY.y) / 2 };
    text(drawRoot, dm.x - 14, dm.y, labels.tbd,
         { fill: COLORS.t1, weight: 600, anchor: 'end' });
    text(drawRoot, PULLEY.x - 14, (PULLEY.y + CRATE.top) / 2, labels.tab,
         { fill: COLORS.w, weight: 600, anchor: 'end' });
    const cm = { x: (PULLEY.x + C.x) / 2, y: (PULLEY.y + C.y) / 2 };
    text(drawRoot, cm.x + 14, cm.y, labels.tbc,
         { fill: COLORS.t2, weight: 600 });
    text(drawRoot, PULLEY.x, CRATE.top + CRATE.h / 2 + 5, `W = ${Math.round(s.W)} N`,
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
