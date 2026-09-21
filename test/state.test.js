import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/state.js';
import { BETA_SPECIAL, BETA_MIN, BETA_MAX, WEIGHT_MAX } from '../src/physics.js';

test('opens on the textbook case', () => {
  const s = createState().getState();
  assert.strictEqual(s.beta, BETA_SPECIAL);
  assert.strictEqual(s.W, 500);
  assert.strictEqual(s.TAB, 500);
  assert.strictEqual(s.TBC, 500);
  assert.ok(Math.abs(s.theta - 78.69006752597979) < 1e-9);
});

test('notifies once per real change and not at all for a no-op', () => {
  const st = createState();
  let calls = 0;
  st.subscribe(() => calls++);
  st.setWeight(500);                 // already 500
  assert.strictEqual(calls, 0);
  st.setWeight(520);
  assert.strictEqual(calls, 1);
  st.setWeight(520);                 // unchanged
  assert.strictEqual(calls, 1);
  st.setWeight(1e9);                 // clamps to WEIGHT_MAX, a real change
  assert.strictEqual(calls, 2);
  assert.strictEqual(st.getState().W, WEIGHT_MAX);
  st.setWeight(1e9);                 // clamps to the same value: no-op
  assert.strictEqual(calls, 2);
});

test('setBeta snaps to the detent but setBetaExact does not', () => {
  const st = createState();
  st.setBetaExact(BETA_MIN);
  st.setBeta(BETA_SPECIAL + 1.0);
  assert.strictEqual(st.getState().beta, BETA_SPECIAL);
  st.setBetaExact(BETA_SPECIAL + 1.0);
  assert.strictEqual(st.getState().beta, BETA_SPECIAL + 1.0);
});

test('repeated keyboard steps escape the detent and never fall back in', () => {
  // scene.js rounds to a whole degree before stepping; this models that contract.
  // If setBetaExact snapped, 68 would land back on BETA_SPECIAL (0.62 away, inside
  // the 1.5 tolerance) and every later press would too -- the value would stick
  // forever. That is exactly the trap this test exists to catch.
  const st = createState();
  assert.strictEqual(st.getState().beta, BETA_SPECIAL);
  const seen = [];
  for (let i = 0; i < 5; i++) {
    st.setBetaExact(Math.round(st.getState().beta) + 1);
    seen.push(st.getState().beta);
  }
  assert.deepStrictEqual(seen, [68, 69, 70, 71, 72]);
});

test('beta is clamped at both ends', () => {
  const st = createState();
  st.setBetaExact(-999);
  assert.strictEqual(st.getState().beta, BETA_MIN);
  st.setBetaExact(999);
  assert.strictEqual(st.getState().beta, BETA_MAX);
});

test('unsubscribe stops delivery', () => {
  const st = createState();
  let calls = 0;
  const off = st.subscribe(() => calls++);
  st.setWeight(300);
  assert.strictEqual(calls, 1);
  off();
  st.setWeight(400);
  assert.strictEqual(calls, 1);
});

test('setBeta notifies once per real change and not at all for a no-op', () => {
  const st = createState();
  let calls = 0;
  st.subscribe(() => calls++);
  st.setBeta(BETA_SPECIAL);        // already at BETA_SPECIAL
  assert.strictEqual(calls, 0);
  st.setBeta(50);
  assert.strictEqual(calls, 1);
  st.setBeta(50);                  // unchanged
  assert.strictEqual(calls, 1);
  st.setBeta(-999);                // clamps to BETA_MIN, a real change
  assert.strictEqual(calls, 2);
  st.setBeta(-999);                // clamps to BETA_MIN again: no-op
  assert.strictEqual(calls, 2);
  assert.strictEqual(st.getState().beta, BETA_MIN);
});

test('setBetaExact notifies once per real change and not at all for a no-op', () => {
  const st = createState();
  let calls = 0;
  st.subscribe(() => calls++);
  st.setBetaExact(BETA_SPECIAL);   // already at BETA_SPECIAL
  assert.strictEqual(calls, 0);
  st.setBetaExact(60);
  assert.strictEqual(calls, 1);
  st.setBetaExact(60);             // unchanged
  assert.strictEqual(calls, 1);
  st.setBetaExact(999);            // clamps to BETA_MAX, a real change
  assert.strictEqual(calls, 2);
  st.setBetaExact(999);            // clamps to BETA_MAX again: no-op
  assert.strictEqual(calls, 2);
  assert.strictEqual(st.getState().beta, BETA_MAX);
});
