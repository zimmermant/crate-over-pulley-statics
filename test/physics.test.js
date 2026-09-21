import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEG, BETA_MIN, BETA_MAX, WEIGHT_MIN, WEIGHT_MAX, BETA_SPECIAL, SNAP_TOL,
  clampBeta, clampWeight, snapBeta, solve, weightFromMagnitude
} from '../src/physics.js';

test('T_BD and theta match a first-principles vector sum of the two rope pulls', () => {
  // Derive the answer WITHOUT the closed form: a frictionless pulley makes both
  // segments carry W, so add their pulls as vectors and negate the result. This
  // is a different derivation, not a restatement of solve(), so it catches a
  // sign slip, a lost factor of 2, or a botched half-angle.
  for (const W of [100, 237.5, 500, 600]) {
    for (let beta = BETA_MIN; beta <= BETA_MAX + 1e-9; beta += 0.5) {
      const b = beta * DEG;
      const sumX = W * Math.cos(b);            // pull toward C
      const sumY = -W - W * Math.sin(b);       // crate straight down, plus C's vertical part
      const needX = -sumX, needY = -sumY;
      const mag = Math.hypot(needX, needY);
      const ang = Math.atan2(needY, -needX) / DEG;   // measured from the NEGATIVE x-axis

      const s = solve({ W, beta });
      assert.ok(Math.abs(s.TBD - mag) < 1e-9, `TBD at W=${W} beta=${beta}`);
      assert.ok(Math.abs(s.theta - ang) < 1e-9, `theta at W=${W} beta=${beta}`);
    }
  }
});

test('reproduces the textbook 5-12-13 answer exactly', () => {
  const s = solve({ W: 500, beta: BETA_SPECIAL });
  assert.ok(Math.abs(s.theta - 78.69006752597979) < 1e-9);
  assert.ok(Math.abs(s.TBD / 500 - Math.sqrt(650) / 13) < 1e-12);
  assert.ok(Math.abs(Math.tan(s.theta * DEG) - 5) < 1e-9);   // tan(theta) = 5 exactly
});

test('both rope segments carry exactly the crate weight', () => {
  for (const W of [100, 350, 600]) {
    for (let beta = BETA_MIN; beta <= BETA_MAX; beta += 2.5) {
      const s = solve({ W, beta });
      assert.strictEqual(s.TAB, W);
      assert.strictEqual(s.TBC, W);
    }
  }
});

test('theta ignores the weight while T_BD scales with it', () => {
  // Verify absolute values at a test point to pin the formula
  const s60 = solve({ W: 500, beta: 60 });
  assert.strictEqual(s60.theta, 75);
  assert.ok(Math.abs(s60.TBD - 500 * 2 * Math.cos(Math.PI / 4 - 30 * DEG)) < 1e-9,
            'TBD formula at beta=60, W=500');

  for (let beta = BETA_MIN; beta <= BETA_MAX; beta += 1) {
    assert.strictEqual(solve({ W: WEIGHT_MIN, beta }).theta,
                       solve({ W: WEIGHT_MAX, beta }).theta);
    const one = solve({ W: 100, beta }).TBD;
    const two = solve({ W: 200, beta }).TBD;
    assert.ok(Math.abs(two - 2 * one) < 1e-9, `T_BD must scale at beta=${beta}`);
  }
});

test('theta advances at exactly half betas rate', () => {
  for (let beta = BETA_MIN; beta + 20 <= BETA_MAX; beta += 0.5) {
    const d = solve({ W: 500, beta: beta + 20 }).theta - solve({ W: 500, beta }).theta;
    assert.ok(Math.abs(d - 10) < 1e-12, `expected 10 deg of theta per 20 of beta, got ${d}`);
  }
});

test('clamps coerce non-numeric input instead of passing it through', () => {
  for (const bad of ['abc', undefined, null, NaN, Infinity, {}]) {
    assert.strictEqual(clampBeta(bad), BETA_MIN);
    assert.strictEqual(clampWeight(bad), WEIGHT_MIN);
  }
  assert.strictEqual(clampBeta(-300), BETA_MIN);
  assert.strictEqual(clampBeta(1000), BETA_MAX);
  assert.strictEqual(clampWeight(1e9), WEIGHT_MAX);
});

test('the detent snaps nearby values and leaves distant ones alone', () => {
  assert.strictEqual(SNAP_TOL, 1.5);
  assert.strictEqual(snapBeta(BETA_SPECIAL + 1.0), BETA_SPECIAL);
  assert.strictEqual(snapBeta(BETA_SPECIAL - 1.0), BETA_SPECIAL);
  assert.strictEqual(snapBeta(BETA_SPECIAL + 2.0), BETA_SPECIAL + 2.0);
  assert.strictEqual(snapBeta(BETA_SPECIAL - 2.0), BETA_SPECIAL - 2.0);
  // Boundary tests: exactly at tolerance and just beyond
  assert.strictEqual(snapBeta(BETA_SPECIAL + SNAP_TOL), BETA_SPECIAL);
  assert.notStrictEqual(snapBeta(BETA_SPECIAL + SNAP_TOL + 1e-9), BETA_SPECIAL);
  assert.strictEqual(snapBeta(1000), BETA_MAX);          // clamping still applies
});

test('every arrowhead length inverts back to the weight that drew it', () => {
  for (const W of [100, 275, 400, 600]) {
    for (let beta = BETA_MIN; beta <= BETA_MAX; beta += 5) {
      const s = solve({ W, beta });
      assert.ok(Math.abs(weightFromMagnitude(s.TAB, 'ab', beta) - W) < 1e-9);
      assert.ok(Math.abs(weightFromMagnitude(s.TBC, 'bc', beta) - W) < 1e-9);
      assert.ok(Math.abs(weightFromMagnitude(s.TBD, 'bd', beta) - W) < 1e-9);
    }
  }
});
