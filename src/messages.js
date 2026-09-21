import { BETA_SPECIAL, BETA_MIN, BETA_MAX } from './physics.js';

// Pure, so it can be tested without a DOM. Every number is rounded here, at the
// moment of display, from the live unrounded state -- never hard-coded.
export function pickMessage(s, prev) {
  const w = Math.round(s.W);
  const tbd = Math.round(s.TBD);
  const changedW = prev && Math.abs(s.W - prev.W) > 1e-9;
  const changedB = prev && Math.abs(s.beta - prev.beta) > 1e-9;
  // Exact, not a tolerance: only setBeta's pointer snap (and the opening state)
  // land here, and only there does the 5-12-13 ratio actually hold.
  const atDetent = Math.abs(s.beta - BETA_SPECIAL) < 1e-9;
  const atMax = s.beta >= BETA_MAX - 1e-9;
  const atMin = s.beta <= BETA_MIN + 1e-9;

  if (changedW) {
    return `W went from ${Math.round(prev.W)} N to ${w} N and θ did not move. ` +
           `It never does — θ = 45° + β/2 depends only on where C sits. ` +
           `T_BD scaled with the load, to ${tbd} N.`;
  }

  if (changedB) {
    if (atDetent) {
      return `The textbook case: the rope runs 5 across for every 12 down, 13 along its ` +
             `length. β = ${s.beta.toFixed(1)}°, θ = ${s.theta.toFixed(1)}°, ` +
             `T_BD = 1.96 W = ${tbd} N.`;
    }
    const db = Math.abs(s.beta - prev.beta);
    const half = `β moved ${db.toFixed(1)}°, θ moved ${(db / 2).toFixed(1)}°. ` +
                 `θ always moves half as far, because the support rope tracks the ` +
                 `bisector of the two rope segments. Now θ = ${s.theta.toFixed(1)}°, ` +
                 `T_BD = ${tbd} N.`;
    if (atMax) {
      return half + ` The anchor is as steep as it goes: both segments now pull almost ` +
             `straight down and their resultant approaches 2W, already at ${(s.TBD / s.W).toFixed(2)} W.`;
    }
    if (atMin) {
      return half + ` The anchor is as far out as it goes: the two pulls have opened up, ` +
             `with their resultant down to ${(s.TBD / s.W).toFixed(2)} W, and a horizontal BC ` +
             `would approach √2·W.`;
    }
    return half;
  }

  // No change: the first render of the session. The app always opens at
  // beta = BETA_SPECIAL (see state.js's createState), so atDetent is always
  // true here and this branch is the only one of this function's "first
  // render" branches that is ever actually reached.
  if (atDetent) {
    return `The textbook case: the rope runs 5 across for every 12 down, 13 along its ` +
           `length. β = ${s.beta.toFixed(1)}°, θ = ${s.theta.toFixed(1)}°, ` +
           `T_BD = 1.96 W = ${tbd} N.`;
  }

  // Unreachable in the running app: prev === null only happens on the startup
  // render, and startup always lands on the detent, which the branch above
  // always catches first. This is kept as the correct default first-render
  // message for a state other than the detent, in case the opening state ever
  // changes -- and pickMessage is still exercised directly at prev = null with
  // other betas, as a pure function, in messages.test.js.
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
