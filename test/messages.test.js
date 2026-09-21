import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, BETA_SPECIAL, BETA_MIN, BETA_MAX } from '../src/physics.js';
import { pickMessage } from '../src/messages.js';

function snap(W, beta) { return { W, beta, ...solve({ W, beta }) }; }

test('always returns a non-empty string', () => {
  for (const W of [100, 350, 600]) {
    for (let beta = BETA_MIN; beta <= BETA_MAX; beta += 0.5) {
      const m = pickMessage(snap(W, beta), null);
      assert.ok(typeof m === 'string' && m.length > 20, `at W=${W} beta=${beta}`);
    }
  }
});

test('names the textbook case at the detent and not away from it', () => {
  assert.match(pickMessage(snap(500, BETA_SPECIAL), null), /5 across/);
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
  const m = pickMessage(snap(300, BETA_SPECIAL), null);
  assert.match(m, /588/);        // 1.96116 * 300 = 588.3
  assert.doesNotMatch(m, /981/);
});

test('landing on the detent via a beta change announces the textbook case', () => {
  const prev = snap(500, 50);
  const now = snap(500, BETA_SPECIAL);
  const m = pickMessage(now, prev);
  assert.match(m, /5 across/);
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

test('a beta of 67.3 must NOT claim the 5-12-13 ratio', () => {
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
