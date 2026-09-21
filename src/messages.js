import { BETA_SPECIAL, BETA_MIN, BETA_MAX, SNAP_TOL } from './physics.js';

// Pure, so it can be tested without a DOM. Every number is rounded here, at the
// moment of display, from the live unrounded state -- never hard-coded.
export function pickMessage(s, prev) {
  const w = Math.round(s.W);
  const tbd = Math.round(s.TBD);

  if (prev && Math.abs(s.W - prev.W) > 1e-9 && Math.abs(s.beta - prev.beta) < 1e-9) {
    return `W went from ${Math.round(prev.W)} N to ${w} N and θ did not move. ` +
           `It never does — θ = 45° + β/2 depends only on where C sits. ` +
           `T_BD scaled with the load, to ${tbd} N.`;
  }

  if (prev && Math.abs(s.beta - prev.beta) > 1e-9) {
    const db = Math.abs(s.beta - prev.beta);
    return `β moved ${db.toFixed(1)}°, θ moved ${(db / 2).toFixed(1)}°. ` +
           `θ always moves half as far, because the support rope tracks the ` +
           `bisector of the two rope segments. Now θ = ${s.theta.toFixed(1)}°, ` +
           `T_BD = ${tbd} N.`;
  }

  if (Math.abs(s.beta - BETA_SPECIAL) <= SNAP_TOL / 10) {
    return `The textbook case: the rope runs 5 across for every 12 down, 13 along its ` +
           `length. β = ${s.beta.toFixed(1)}°, θ = ${s.theta.toFixed(1)}°, ` +
           `T_BD = 1.96 W = ${tbd} N.`;
  }

  if (s.beta > BETA_MAX - 3) {
    return `With BC nearly vertical both segments pull almost straight down, so their ` +
           `resultant approaches 2W and θ approaches straight up. T_BD is already ` +
           `${tbd} N, or ${(s.TBD / s.W).toFixed(2)} W.`;
  }

  if (s.beta < BETA_MIN + 3) {
    return `Sliding C away opens the angle between the two pulls, so their resultant ` +
           `shrinks: T_BD is down to ${(s.TBD / s.W).toFixed(2)} W. Carried all the way ` +
           `to a horizontal BC it would approach √2·W.`;
  }

  return `A frictionless pulley redirects the rope without changing its tension, so both ` +
         `segments carry ${w} N. Two equal pulls add along the bisector of the angle ` +
         `between them, which is why θ = ${s.theta.toFixed(1)}° and ` +
         `T_BD = ${tbd} N.`;
}

export function createMessages(node) {
  let prev = null;
  function render(s) {
    node.textContent = pickMessage(s, prev);
    prev = s;
  }
  return { render };
}
