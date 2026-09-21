// Statics of a crate hung over a pulley, with the pulley held by a support rope.
//
// The rope runs from the crate at A, up over the pulley at B, and down to a
// ground anchor at C. A frictionless pulley redirects a rope without changing
// its tension, so BOTH segments carry the crate's weight W. That one constraint
// is what makes the problem determinate: it supplies a fourth equation, and the
// support rope's angle theta stops being an input and becomes an answer.
//
// No DOM. Degrees in, degrees out; radians live only inside this file.

export const DEG = Math.PI / 180;

export const BETA_MIN = 44;
export const BETA_MAX = 77;
export const WEIGHT_MIN = 100;
export const WEIGHT_MAX = 600;

// The Pythagorean triples the rope can snap to. Each is oriented with the SHORT leg
// across and the LONG leg down, which is how the classic figure reads: "5 across for
// every 12 down, 13 along the rope". Named ascending, across-down-hyp.
export const TRIPLES = [
  { across: 3, down: 4,  hyp: 5 },
  { across: 8, down: 15, hyp: 17 },
  { across: 5, down: 12, hyp: 13 },
  { across: 7, down: 24, hyp: 25 }
];

export function tripleBeta(t) { return Math.atan2(t.down, t.across) / DEG; }

export function tripleAt(beta) {
  for (const t of TRIPLES) {
    if (Math.abs(beta - tripleBeta(t)) < 1e-9) {
      return t;
    }
  }
  return null;
}

// The figure's 5-12-13 slope: 5 across for every 12 down.
export const BETA_SPECIAL = tripleBeta(TRIPLES[2]);
export const SNAP_TOL = 1.5;

// Coerces its own parameter because it does arithmetic -- a non-numeric or
// non-finite input would silently produce NaN, and a comparison against NaN is
// always false, so an unguarded clamp would return the bad value untouched.
export function clampTo(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}

export function clampBeta(deg) { return clampTo(deg, BETA_MIN, BETA_MAX); }
export function clampWeight(n) { return clampTo(n, WEIGHT_MIN, WEIGHT_MAX); }

// Pointer drags land exactly on the textbook geometry when they come close.
// Keyboard stepping must NOT route through here: an arrow key that re-snapped
// would fall back into the well on every press and never climb out.
export function snapBeta(deg) {
  const v = clampBeta(deg);
  let closest = null;
  let closestDist = SNAP_TOL + 1;
  for (const t of TRIPLES) {
    const tBeta = tripleBeta(t);
    const dist = Math.abs(v - tBeta);
    if (dist < closestDist) {
      closestDist = dist;
      closest = t;
    }
  }
  if (closestDist <= SNAP_TOL && closest !== null) {
    return tripleBeta(closest);
  }
  return v;
}

// Both rope segments carry W, and the resultant of two equal pulls lies along
// the bisector of the angle between them. The segments pull along -90 degrees
// (down to the crate) and -beta (down to the anchor), so their resultant lies
// at -(90 + beta)/2, and the support rope -- which cancels it -- lies opposite:
//     theta = 45 + beta/2          measured from the NEGATIVE x-axis
//     T_BD  = 2 W cos(45 - beta/2)
export function solve({ W, beta }) {
  const b = beta * DEG;
  return {
    TAB: W,
    TBC: W,
    TBD: 2 * W * Math.cos(Math.PI / 4 - b / 2),
    theta: 45 + beta / 2
  };
}

// Inverse of the arrow lengths, for dragging an FBD arrowhead. Every arrow is a
// fixed multiple of W at a given beta, so any one of them determines W.
export function weightFromMagnitude(mag, which, beta) {
  const m = Number(mag);
  if (!Number.isFinite(m)) return WEIGHT_MIN;
  if (which === 'bd') {
    const k = 2 * Math.cos(Math.PI / 4 - clampBeta(beta) * DEG / 2);
    return clampWeight(m / k);
  }
  return clampWeight(m);        // the 'ab' and 'bc' arrows are both W long
}
