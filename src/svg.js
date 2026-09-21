export const NS = 'http://www.w3.org/2000/svg';

// One palette for the whole app. It lives here rather than in each renderer
// because build.js concatenates every module into a single scope, so a
// top-level `const C1` in three files would collide and fail the build.
export const COLORS = {
  t1: '#e06c3a',   // support rope tension T_BD
  t2: '#3a86c8',   // rope to the ground anchor, T_BC
  w:  '#6b7280',   // the crate's weight W
  ink: '#111827',  // pulley, ropes and structure
  annot: '#9aa3af' // muted ink for measurement annotations (gamma/delta arcs and
                    // their reference line) -- distinct from every rope/force color
                    // so they read as "the geometry teacher drew on it", not as rope
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

// A force label is a LIST OF PARTS rather than a string, so its subscript can
// render as a real <tspan> here and a real <sub> in the HTML panels instead of a
// literal underscore. Stating the subscript once, where the label is built, is
// what keeps the scene, the free-body diagram, the force triangle and the
// aria-labels from drifting into different spellings of the same force.
export function forceParts(sub, newtons) {
  return ['T', { sub }, ` = ${newtons} N`];
}

// A part is a subscript only if it is an OBJECT carrying a string `sub`. Testing
// `p.sub !== undefined` alone silently treats every plain string as a subscript,
// because String.prototype.sub is a real (legacy) method on every string.
function isSubPart(p) {
  return p !== null && typeof p === 'object' && typeof p.sub === 'string';
}

// Flatten to the underscore spelling, for aria-labels and for tests that read a
// label's number back out.
export function partsToString(parts) {
  if (!Array.isArray(parts)) return String(parts);
  return parts.map(p => isSubPart(p) ? `_${p.sub}` : String(p)).join('');
}

// The subscript drops by SUB_DY and shrinks to SUB_SCALE of the label's size; the
// part after it lifts the baseline straight back, so the tail sits level with the
// leading `T` rather than staying sunk for the rest of the string.
const SUB_DY = 3.5;
const SUB_SCALE = 0.72;

// Text with a background-coloured halo so labels stay readable where they cross lines.
// `str` is either a plain string or a parts list from forceParts().
export function text(parent, x, y, str, opts = {}) {
  const size = opts.size || 13;
  const node = el('text', {
    x, y,
    'font-size': size,
    'font-family': 'system-ui, -apple-system, sans-serif',
    fill: opts.fill || COLORS.ink,
    'text-anchor': opts.anchor || 'start',
    'font-weight': opts.weight || 400,
    'paint-order': 'stroke',
    stroke: '#ffffff',
    'stroke-width': opts.halo === false ? 0 : 3.5,
    'stroke-linejoin': 'round'
  }, parent);
  if (Array.isArray(str)) {
    let afterSub = false;
    for (const part of str) {
      if (isSubPart(part)) {
        el('tspan', { dy: SUB_DY, 'font-size': Math.round(size * SUB_SCALE * 100) / 100 },
           node).textContent = part.sub;
        afterSub = true;
      } else {
        el('tspan', afterSub ? { dy: -SUB_DY } : {}, node).textContent = String(part);
        afterSub = false;
      }
    }
  } else {
    node.textContent = str;
  }
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
