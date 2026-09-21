import { clampBeta, clampWeight, snapBeta, solve, BETA_SPECIAL } from './physics.js';

// The ONLY stored state is these two numbers. Every tension and theta is derived
// on read, which is what makes it structurally impossible for two panels to
// disagree -- there is one copy of the truth.
export function createState() {
  let W = 500;
  let beta = BETA_SPECIAL;
  let subscribers = [];

  function getState() {
    const { TAB, TBC, TBD, theta } = solve({ W, beta });
    return { W, beta, TAB, TBC, TBD, theta };
  }

  function notify() {
    const snapshot = getState();
    for (const fn of subscribers.slice()) fn(snapshot);
  }

  // Pointer path: lands exactly on the textbook geometry when it comes close.
  function setBeta(deg) {
    const v = snapBeta(deg);
    if (v === beta) return;
    beta = v;
    notify();
  }

  // Keyboard path: clamps but never snaps, so repeated arrow presses move on a
  // uniform grid and can never be trapped in the detent's well.
  function setBetaExact(deg) {
    const v = clampBeta(deg);
    if (v === beta) return;
    beta = v;
    notify();
  }

  function setWeight(n) {
    const v = clampWeight(n);
    if (v === W) return;
    W = v;
    notify();
  }

  function subscribe(fn) {
    subscribers.push(fn);
    return () => { subscribers = subscribers.filter(f => f !== fn); };
  }

  return { getState, setBeta, setBetaExact, setWeight, subscribe };
}
