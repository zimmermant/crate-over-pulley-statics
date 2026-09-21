import { DEG, BETA_MIN, BETA_MAX, WEIGHT_MIN, WEIGHT_MAX, solve } from './physics.js';
import { el, clear, text, COLORS, clientToSvg } from './svg.js';

export const FBD_VB = { w: 720, h: 620 };
export const FBD_ORIGIN = { x: 365, y: 368 };

// A FIXED scale, with no clipping machinery. T_BD <= 2W always, so the longest
// reachable arrow is 2 * WEIGHT_MAX * FBD_SCALE = 240px and always fits. The
// ball-on-ramp app needed clipping only because its tensions ran to infinity.
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

    const spec = [
      ['bd', COLORS.t1, `T_BD = ${Math.round(s.TBD)} N`],
      ['bc', COLORS.t2, `T_BC = ${Math.round(s.TBC)} N`],
      ['ab', COLORS.w,  `T_AB = ${Math.round(s.TAB)} N`]
    ];
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
    }

    el('circle', { cx: FBD_ORIGIN.x, cy: FBD_ORIGIN.y, r: 6, fill: COLORS.ink }, drawRoot);
    text(drawRoot, FBD_ORIGIN.x + 12, FBD_ORIGIN.y - 12, 'B', { weight: 600 });
  }

  void actions;
  void latest;
  void BETA_MIN;
  void BETA_MAX;
  void clientToSvg;
  void solve;
  return { render };
}
