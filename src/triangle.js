import { DEG } from './physics.js';
import { el, clear, text, COLORS } from './svg.js';

export const TRI_VB = { w: 480, h: 380 };
const TRI_PAD = 0.12;

// Tip-to-tail in MATHS coordinates (y up), starting at the origin:
// the crate's pull straight down, then the pull toward C, then T_BD closes it.
export function trianglePoints(s) {
  const a = { x: 0, y: 0 };
  const b = { x: a.x, y: a.y - s.TAB };
  const c = { x: b.x + s.TBC * Math.cos(s.beta * DEG),
              y: b.y - s.TBC * Math.sin(s.beta * DEG) };
  return [a, b, c];
}

// Auto-fit, because this panel's job is the SHAPE of the closure, not the size.
// The scene and the free-body diagram both carry the magnitudes.
export function fitTriangle(pts, vb) {
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = Math.max(maxX - minX, 1e-9), h = Math.max(maxY - minY, 1e-9);
  const scale = Math.min(vb.w * (1 - 2 * TRI_PAD) / w, vb.h * (1 - 2 * TRI_PAD) / h);
  return {
    scale,
    offset: {
      x: vb.w / 2 - (minX + maxX) / 2 * scale,
      y: vb.h / 2 + (minY + maxY) / 2 * scale
    }
  };
}

export function createTriangle(svg) {
  const root = el('g', {}, svg);

  function render(s) {
    clear(root);
    const pts = trianglePoints(s);
    const { scale, offset } = fitTriangle(pts, TRI_VB);
    const px = q => ({ x: offset.x + q.x * scale, y: offset.y - q.y * scale });
    const [a, b, c] = pts.map(px);

    const legs = [
      [a, b, COLORS.w,  `T_AB = ${Math.round(s.TAB)} N`],
      [b, c, COLORS.t2, `T_BC = ${Math.round(s.TBC)} N`],
      [c, a, COLORS.t1, `T_BD = ${Math.round(s.TBD)} N`]
    ];
    for (const [from, to, color, label] of legs) {
      el('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y,
                   stroke: color, 'stroke-width': 4 }, root);
      const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
      // Push the label away from the triangle's centre so it never sits on a leg.
      const cxx = (a.x + b.x + c.x) / 3, cyy = (a.y + b.y + c.y) / 3;
      const ux = mx - cxx, uy = my - cyy;
      const n = Math.hypot(ux, uy) || 1;
      text(root, mx + 22 * ux / n, my + 22 * uy / n + 5, label,
           { fill: color, weight: 600, anchor: ux < 0 ? 'end' : 'start' });
    }

    text(root, 12, TRI_VB.h - 12,
         `scale: ${(1 / scale).toFixed(1)} N per pixel — shape only, the size is fitted`,
         { size: 11, fill: '#9aa1ab' });
  }

  return { render };
}
