import { DEG } from './physics.js';
import { el, clear, text, forceParts, COLORS } from './svg.js';

export const TRI_VB = { w: 480, h: 380 };
const TRI_PAD = 0.12;

// Tip-to-tail in MATHS coordinates (y up), starting at the origin:
// the crate's pull straight down, then the pull toward C, then T_BD closes it.
export function trianglePoints(s) {
  const a = { x: 0, y: 0 };
  const b = { x: a.x, y: a.y - s.TBA };
  const c = { x: b.x + s.TBC * Math.cos(s.beta * DEG),
              y: b.y - s.TBC * Math.sin(s.beta * DEG) };
  return [a, b, c];
}

// Auto-fit, because this panel's job is the SHAPE of the closure, not the size.
// The scene and the free-body diagram both carry the magnitudes.
// Pure, so a test can check it against sceneLabels/fbdLabels/terms without a
// DOM. render() below must build its force labels only from this function,
// never inline, so the triangle can never drift from what the other panels say.
export function triangleLabels(s) {
  return {
    tba: forceParts('BA', Math.round(s.TBA)),
    tbc: forceParts('BC', Math.round(s.TBC)),
    tbd: forceParts('BD', Math.round(s.TBD))
  };
}

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

    const labels = triangleLabels(s);
    const legs = [
      [a, b, COLORS.w,  labels.tba],
      [b, c, COLORS.t2, labels.tbc],
      [c, a, COLORS.t1, labels.tbd]
    ];
    for (const [from, to, color, label] of legs) {
      el('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y,
                   stroke: color, 'stroke-width': 4 }, root);
      const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
      // Perpendicular to THIS leg, not the direction from the centroid: for a thin
      // triangle the centroid-to-midpoint direction runs nearly along the leg, which
      // is what put these labels on top of the lines.
      const cxx = (a.x + b.x + c.x) / 3, cyy = (a.y + b.y + c.y) / 3;
      const lx = to.x - from.x, ly = to.y - from.y;
      const ln = Math.hypot(lx, ly) || 1;
      let nx = -ly / ln, ny = lx / ln;
      if (nx * (mx - cxx) + ny * (my - cyy) < 0) { nx = -nx; ny = -ny; }
      text(root, mx + 24 * nx, my + 24 * ny + 5, label,
           { fill: color, weight: 600, anchor: nx < 0 ? 'end' : 'start' });
    }

    // "N per viewBox unit", not "N per pixel": the SVG is always CSS-scaled to
    // fit its panel, so a student measuring with a ruler on screen would get a
    // different number from either unit -- viewBox units are what this scale
    // actually relates the drawing to.
    text(root, 12, TRI_VB.h - 12,
         `scale: ${(1 / scale).toFixed(1)} N per viewBox unit — shape only, the size is fitted`,
         { size: 11, fill: '#9aa1ab' });
  }

  return { render };
}
