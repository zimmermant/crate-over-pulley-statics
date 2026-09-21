export const NS = 'http://www.w3.org/2000/svg';

// One palette for the whole app. It lives here rather than in each renderer
// because build.js concatenates every module into a single scope, so a
// top-level `const C1` in three files would collide and fail the build.
export const COLORS = {
  t1: '#e06c3a',   // support rope tension T_BD
  t2: '#3a86c8',   // rope to the ground anchor, T_BC
  w:  '#6b7280',   // the crate's weight W
  ink: '#111827'   // pulley, ropes and structure
};

export function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, name);
  for (const k in attrs) {
    const v = attrs[k];
    if (v !== null && v !== undefined) node.setAttribute(k, String(v));
  }
  if (parent) parent.appendChild(node);
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// Text with a background-coloured halo so labels stay readable where they cross lines.
export function text(parent, x, y, str, opts = {}) {
  const node = el('text', {
    x, y,
    'font-size': opts.size || 13,
    'font-family': 'system-ui, -apple-system, sans-serif',
    fill: opts.fill || COLORS.ink,
    'text-anchor': opts.anchor || 'start',
    'font-weight': opts.weight || 400,
    'paint-order': 'stroke',
    stroke: '#ffffff',
    'stroke-width': opts.halo === false ? 0 : 3.5,
    'stroke-linejoin': 'round'
  }, parent);
  node.textContent = str;
  return node;
}

// Pointer position in viewBox units. Handles CSS scaling and page scroll correctly,
// which naive clientX - rect.left arithmetic does not.
export function clientToSvg(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
