import { DEG, WEIGHT_MIN, WEIGHT_MAX, weightFromMagnitude } from './physics.js';
import { el, clear, text, COLORS, clientToSvg } from './svg.js';

export const FBD_VB = { w: 720, h: 620 };
export const FBD_ORIGIN = { x: 365, y: 368 };

// A FIXED scale, with no clipping machinery. T_BD <= 2W always, but that bound
// needs beta -> 90 deg, outside [BETA_MIN, BETA_MAX]. The longest reachable
// arrow, at W = WEIGHT_MAX and beta = BETA_MAX, is about 237.9px and always
// fits. The ball-on-ramp app needed clipping only because its tensions ran to
// infinity.
export const FBD_SCALE = 0.20;

// Unit vector of each force in SVG coordinates (y down).
function fbdDir(s, which) {
  if (which === 'ab') return { x: 0, y: 1 };                                        // straight down
  if (which === 'bc') return { x: Math.cos(s.beta * DEG), y: Math.sin(s.beta * DEG) };   // down-right
  return { x: -Math.cos(s.theta * DEG), y: -Math.sin(s.theta * DEG) };             // up-left
}

function fbdMag(s, which) {
  if (which === 'ab') return s.TAB;
  if (which === 'bc') return s.TBC;
  return s.TBD;
}

export function arrowTip(s, which) {
  const d = fbdDir(s, which);
  const len = fbdMag(s, which) * FBD_SCALE;
  return { x: FBD_ORIGIN.x + d.x * len, y: FBD_ORIGIN.y + d.y * len };
}

// Pure, so a test can check it against sceneLabels/triangleLabels/terms without
// a DOM. render() below must build its force labels only from this function,
// never inline, so the FBD can never drift from what the other panels say.
export function fbdLabels(s) {
  return {
    tab: `T_AB = ${Math.round(s.TAB)} N`,
    tbc: `T_BC = ${Math.round(s.TBC)} N`,
    tbd: `T_BD = ${Math.round(s.TBD)} N`
  };
}

// Project the pointer onto the arrow's own direction and read off the length.
// Projecting -- rather than taking the raw distance from the origin -- is what
// keeps a sideways wobble from changing the magnitude.
export function magnitudeFromPointer(p, which, s) {
  const d = fbdDir(s, which);
  const px = p.x - FBD_ORIGIN.x, py = p.y - FBD_ORIGIN.y;
  const along = px * d.x + py * d.y;
  return Math.max(along, 0) / FBD_SCALE;
}

export function createFbd(svg, actions) {
  const drawRoot = el('g', {}, svg);
  const handleRoot = el('g', {}, svg);
  let latest = null;

  const defs = el('defs', {}, svg);
  for (const [key, color] of [['ab', COLORS.w], ['bc', COLORS.t2], ['bd', COLORS.t1]]) {
    const m = el('marker', {
      id: `head-${key}`, viewBox: '0 0 10 10', refX: 8, refY: 5,
      markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse'
    }, defs);
    el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: color }, m);
  }

  const handles = {};
  for (const [key, color] of [['ab', COLORS.w], ['bc', COLORS.t2], ['bd', COLORS.t1]]) {
    const g = el('g', {
      class: 'handle', tabindex: '0', role: 'slider', 'data-fbd': key
    }, handleRoot);
    el('circle', { class: 'hit', r: 20, fill: 'transparent' }, g);
    el('circle', { r: 7, fill: '#fff', stroke: color, 'stroke-width': 3 }, g);
    handles[key] = g;
  }

  function render(s) {
    latest = s;
    clear(drawRoot);

    el('line', { x1: 40, y1: FBD_ORIGIN.y, x2: FBD_VB.w - 40, y2: FBD_ORIGIN.y,
                 stroke: '#e5e7eb', 'stroke-width': 1 }, drawRoot);
    el('line', { x1: FBD_ORIGIN.x, y1: 40, x2: FBD_ORIGIN.x, y2: FBD_VB.h - 40,
                 stroke: '#e5e7eb', 'stroke-width': 1 }, drawRoot);

    const labels = fbdLabels(s);
    const spec = [
      ['bd', COLORS.t1, labels.tbd],
      ['bc', COLORS.t2, labels.tbc],
      ['ab', COLORS.w,  labels.tab]
    ];
    const atLimit = Math.abs(s.W - WEIGHT_MIN) < 1e-9 || Math.abs(s.W - WEIGHT_MAX) < 1e-9;
    for (const [key, color, label] of spec) {
      const t = arrowTip(s, key);
      el('line', {
        x1: FBD_ORIGIN.x, y1: FBD_ORIGIN.y, x2: t.x, y2: t.y,
        stroke: color, 'stroke-width': 4, 'marker-end': `url(#head-${key})`
      }, drawRoot);
      const off = key === 'ab' ? { x: -14, y: 0 } : key === 'bc' ? { x: 16, y: 6 } : { x: -16, y: -4 };
      text(drawRoot, t.x + off.x, t.y + off.y, label,
           { fill: color, weight: 600, anchor: key === 'bc' ? 'start' : 'end' });

      handles[key].setAttribute('transform', `translate(${t.x} ${t.y})`);
      handles[key].setAttribute('aria-valuenow', Math.round(s.W));
      handles[key].setAttribute('aria-valuemin', String(WEIGHT_MIN));
      handles[key].setAttribute('aria-valuemax', String(WEIGHT_MAX));
      handles[key].setAttribute('aria-label', `${label} arrowhead; drag to change the crate weight`);
      handles[key].classList.toggle('handle--limit', atLimit);
    }

    el('circle', { cx: FBD_ORIGIN.x, cy: FBD_ORIGIN.y, r: 6, fill: COLORS.ink }, drawRoot);
    text(drawRoot, FBD_ORIGIN.x + 12, FBD_ORIGIN.y - 12, 'B', { weight: 600 });
  }

  let dragging = null;
  let dragPointerId = null;
  let grabOffset = null;      // true tip minus pointer, recorded at grab time

  function setActive(key) {
    for (const k in handles) handles[k].classList.toggle('handle--active', k === key);
  }

  svg.addEventListener('pointerover', e => {
    const g = e.target.closest('[data-fbd]');
    if (g && !dragging) setActive(g.getAttribute('data-fbd'));
  });
  svg.addEventListener('pointerout', () => { if (!dragging) setActive(null); });
  handleRoot.addEventListener('focusin', e => {
    const g = e.target.closest('[data-fbd]');
    if (g) setActive(g.getAttribute('data-fbd'));
  });
  handleRoot.addEventListener('focusout', () => { if (!dragging) setActive(null); });

  svg.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const g = e.target.closest('[data-fbd]');
    if (!g || !latest) return;
    // Only start the drag once capture has actually succeeded. A pointerup
    // outside the svg only reaches endDrag if capture is held, so latching
    // `dragging` before this call could leave a drag live but uncaptured.
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      return;                 // capture failed: do not start a drag we cannot end
    }
    dragging = g.getAttribute('data-fbd');
    dragPointerId = e.pointerId;
    g.focus();
    setActive(dragging);
    // Grab the arrow where the user actually took hold of it, so it does not
    // jump to the cursor on the first pointermove.
    const p = clientToSvg(svg, e.clientX, e.clientY);
    const tip = arrowTip(latest, dragging);
    grabOffset = { x: tip.x - p.x, y: tip.y - p.y };
    e.preventDefault();
  });

  svg.addEventListener('pointermove', e => {
    if (!dragging || e.pointerId !== dragPointerId || !latest) return;
    const p = clientToSvg(svg, e.clientX, e.clientY);
    const anchored = { x: p.x + grabOffset.x, y: p.y + grabOffset.y };
    const mag = magnitudeFromPointer(anchored, dragging, latest);
    actions.setWeight(weightFromMagnitude(mag, dragging, latest.beta));
  });

  function endDrag(e) {
    if (!dragging || e.pointerId !== dragPointerId) return;
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    dragging = null;
    dragPointerId = null;
    grabOffset = null;
    const focused = document.activeElement && document.activeElement.closest
      ? document.activeElement.closest('[data-fbd]') : null;
    setActive(focused ? focused.getAttribute('data-fbd') : null);
  }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  handleRoot.addEventListener('keydown', e => {
    if (!e.target.closest('[data-fbd]') || !latest) return;
    const step = e.shiftKey ? 1 : 10;
    let delta = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') delta = step;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') delta = -step;
    else return;
    e.preventDefault();
    // Round the base before stepping, the same contract scene.js's keyboardStep
    // uses -- otherwise a drag to a fractional W (e.g. 437.62) leaves ArrowUp
    // stepping off that fraction forever, and aria-valuenow (which rounds)
    // announces a number the stored state never actually reaches. Shift stays
    // unrounded, as the scene does, so fine adjustment still works.
    const base = e.shiftKey ? latest.W : Math.round(latest.W);
    actions.setWeight(base + delta);
  });

  return { render };
}
