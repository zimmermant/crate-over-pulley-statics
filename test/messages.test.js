import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, tripleAt, BETA_SPECIAL, BETA_MIN, BETA_MAX, TRIPLES, tripleBeta } from '../src/physics.js';
import { pickMessage } from '../src/messages.js';

function snap(W, beta) { return { W, beta, ...solve({ W, beta }) }; }

// prev = null only happens on the app's startup render, and startup is always
// (W=500, beta=BETA_SPECIAL) -- see state.js. Most of the (W, beta) pairs this
// sweeps are therefore states the running app can never actually pass to
// pickMessage with prev = null; this exercises pickMessage as a pure function
// over its whole input space, not as a claim that the app can reach them.
test('always returns a non-empty string', () => {
  for (const W of [100, 350, 600]) {
    for (let beta = BETA_MIN; beta <= BETA_MAX; beta += 0.5) {
      const m = pickMessage(snap(W, beta), null);
      assert.ok(typeof m === 'string' && m.length > 20, `at W=${W} beta=${beta}`);
    }
  }
});

test('names the detent triple correctly and not away from detent', () => {
  // (500, BETA_SPECIAL, prev=null) is the app's actual startup state.
  // BETA_SPECIAL is the 5-12-13 detent.
  assert.match(pickMessage(snap(500, BETA_SPECIAL), null), /5-12-13/);
  assert.match(pickMessage(snap(500, BETA_SPECIAL), null), /5 across/);
  assert.match(pickMessage(snap(500, BETA_SPECIAL), null), /classic textbook/);
  // (500, 50, prev=null) is not reachable in the running app -- startup is
  // always at the detent -- so this exercises pickMessage as a pure function.
  assert.doesNotMatch(pickMessage(snap(500, 50), null), /5 across/);
});

test('a weight change reports that theta did not move', () => {
  const prev = snap(500, 60);
  const now = snap(560, 60);
  const m = pickMessage(now, prev);
  assert.match(m, /did not move/);
  assert.match(m, /560/);
});

test('a beta change reports both angles and the exact half-rate', () => {
  const prev = snap(500, 50);
  const now = snap(500, 58);
  const m = pickMessage(now, prev);
  assert.match(m, /8\.0/);       // beta moved 8.0 degrees
  assert.match(m, /4\.0/);       // theta moved 4.0
});

test('the quoted numbers come from the live state, not a constant', () => {
  // A message that hard-coded "981 N" would pass a laxer test than this.
  // (300, BETA_SPECIAL, prev=null) is not reachable in the running app --
  // startup is always W=500 -- so this exercises pickMessage as a pure
  // function rather than an app-reachable state.
  const m = pickMessage(snap(300, BETA_SPECIAL), null);
  assert.match(m, /588/);        // 1.96116 * 300 = 588.3
  assert.doesNotMatch(m, /981/);
});

test('landing on a detent via a beta change announces the triple', () => {
  const prev = snap(500, 50);
  const now = snap(500, BETA_SPECIAL);
  const m = pickMessage(now, prev);
  assert.match(m, /5-12-13/);
  assert.match(m, /5 across/);
  assert.match(m, /classic textbook/);
});

test('arriving at BETA_MAX via a beta change reports both half-rate and steep-limit clause', () => {
  const prev = snap(500, BETA_MAX - 5);
  const now = snap(500, BETA_MAX);
  const m = pickMessage(now, prev);
  assert.match(m, /moved/);  // half-rate message structure
  assert.match(m, /as steep as it goes/);  // the steep-limit clause
  assert.match(m, /2W/);  // reference to 2W limit
});

test('arriving at BETA_MIN via a beta change reports both half-rate and opened-out clause', () => {
  const prev = snap(500, BETA_MIN + 5);
  const now = snap(500, BETA_MIN);
  const m = pickMessage(now, prev);
  assert.match(m, /moved/);  // half-rate message structure
  assert.match(m, /as far out as it goes/);  // the opened-out clause
  assert.match(m, /√2·W/);  // reference to root-2 W limit
});

test('each detent announces the correct triple integers', () => {
  for (const t of TRIPLES) {
    const beta = tripleBeta(t);
    const m = pickMessage(snap(500, beta), null);
    assert.match(m, new RegExp(`${t.across}-${t.down}-${t.hyp}`), `triple ${t.across}-${t.down}-${t.hyp}`);
    assert.match(m, new RegExp(`${t.across} across for every ${t.down} down`), `phrase for ${t.across}-${t.down}-${t.hyp}`);
  }
});

test('each detent announces the correct T_BD/W ratio from live state', () => {
  for (const t of TRIPLES) {
    const W = 500;
    const beta = tripleBeta(t);
    const state = snap(W, beta);
    const expectedRatio = (state.TBD / W).toFixed(2);
    const m = pickMessage(state, null);
    assert.match(m, new RegExp(`T_BD = ${expectedRatio} W`),
      `triple ${t.across}-${t.down}-${t.hyp}: T_BD should be ${expectedRatio} W`);
  }
});

test('a beta a tenth of a degree away from each triple does NOT claim the ratio', () => {
  for (const t of TRIPLES) {
    const beta = tripleBeta(t) + 0.1;
    const m = pickMessage(snap(500, beta), null);
    assert.doesNotMatch(m, new RegExp(`${t.across}-${t.down}-${t.hyp}`), `must not claim ${t.across}-${t.down}-${t.hyp} at beta offset 0.1`);
  }
});

test('a beta of 67.3 must NOT claim the 5-12-13 ratio', () => {
  // (500, 67.3, prev=null) is not reachable in the running app -- startup is
  // always exactly BETA_SPECIAL -- so this exercises pickMessage as a pure
  // function rather than an app-reachable state.
  const m = pickMessage(snap(500, 67.3), null);
  assert.doesNotMatch(m, /5 across/);
});

test('a weight change wins over the detent', () => {
  const prev = snap(500, BETA_SPECIAL);
  const now = snap(600, BETA_SPECIAL);
  const m = pickMessage(now, prev);
  assert.match(m, /did not move/);
  assert.doesNotMatch(m, /5 across/);
});
