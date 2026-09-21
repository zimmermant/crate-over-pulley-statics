import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEG, BETA_MIN, BETA_MAX, WEIGHT_MIN, WEIGHT_MAX, BETA_SPECIAL, SNAP_TOL,
  TRIPLES, tripleBeta, tripleAt,
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

test('each of the four triples has its correct angle', () => {
  const expected = [
    53.13010235415598,    // 3-4-5
    61.92751306414704,    // 8-15-17
    67.38013505195958,    // 5-12-13
    73.73979529168804     // 7-24-25
  ];
  for (let i = 0; i < TRIPLES.length; i++) {
    const angle = tripleBeta(TRIPLES[i]);
    assert.ok(Math.abs(angle - expected[i]) < 1e-9,
              `triple ${i} should be ${expected[i]}, got ${angle}`);
  }
});

test('each triple angle lies inside BETA bounds with margin', () => {
  for (const t of TRIPLES) {
    const beta = tripleBeta(t);
    assert.ok(beta - BETA_MIN > SNAP_TOL,
              `${beta} should be more than SNAP_TOL (${SNAP_TOL}) above BETA_MIN (${BETA_MIN})`);
    assert.ok(BETA_MAX - beta > SNAP_TOL,
              `${beta} should be more than SNAP_TOL (${SNAP_TOL}) below BETA_MAX (${BETA_MAX})`);
  }
});

test('no two triples are within 2*SNAP_TOL of each other', () => {
  const minSeparation = 2 * SNAP_TOL;
  for (let i = 0; i < TRIPLES.length; i++) {
    for (let j = i + 1; j < TRIPLES.length; j++) {
      const sep = Math.abs(tripleBeta(TRIPLES[i]) - tripleBeta(TRIPLES[j]));
      assert.ok(sep >= minSeparation,
                `triples ${i} and ${j} are only ${sep}° apart, need >= ${minSeparation}°`);
    }
  }
});

test('the detents snap nearby values and leave distant ones alone', () => {
  assert.strictEqual(SNAP_TOL, 1.5);
  // Test 5-12-13 as before
  assert.strictEqual(snapBeta(BETA_SPECIAL + 1.0), BETA_SPECIAL);
  assert.strictEqual(snapBeta(BETA_SPECIAL - 1.0), BETA_SPECIAL);
  assert.strictEqual(snapBeta(BETA_SPECIAL + 2.0), BETA_SPECIAL + 2.0);
  assert.strictEqual(snapBeta(BETA_SPECIAL - 2.0), BETA_SPECIAL - 2.0);
  // Boundary tests: exactly at tolerance and just beyond
  assert.strictEqual(snapBeta(BETA_SPECIAL + SNAP_TOL), BETA_SPECIAL);
  assert.notStrictEqual(snapBeta(BETA_SPECIAL + SNAP_TOL + 1e-9), BETA_SPECIAL);
  assert.strictEqual(snapBeta(1000), BETA_MAX);          // clamping still applies

  // Test all other triples snap correctly
  for (let i = 0; i < TRIPLES.length; i++) {
    if (i === 2) continue;  // skip 5-12-13, already tested above
    const beta = tripleBeta(TRIPLES[i]);
    assert.strictEqual(snapBeta(beta + 1.0), beta,
                       `should snap to triple ${i} from +1.0`);
    assert.strictEqual(snapBeta(beta - 1.0), beta,
                       `should snap to triple ${i} from -1.0`);
    assert.strictEqual(snapBeta(beta + 2.0), beta + 2.0,
                       `should NOT snap triple ${i} from +2.0`);
    assert.strictEqual(snapBeta(beta - 2.0), beta - 2.0,
                       `should NOT snap triple ${i} from -2.0`);
  }
});

test('snapBeta picks the nearest triple when within snap range', () => {
  // When a point is within SNAP_TOL of a triple, it snaps to that triple.
  // Test that snapping picks the nearest triple in each window.
  // Given the geometry, windows don't overlap, but test the nearest-picking logic anyway.
  const beta1 = tripleBeta(TRIPLES[0]);
  const beta2 = tripleBeta(TRIPLES[1]);
  // Points inside first triple's window should snap to it
  assert.strictEqual(snapBeta(beta1 + 1.0), beta1);
  assert.strictEqual(snapBeta(beta1 + 1.4), beta1);
  // Points just outside first triple's window should not snap
  assert.strictEqual(snapBeta(beta1 + 1.6), beta1 + 1.6);
  // Points inside second triple's window should snap to it
  assert.strictEqual(snapBeta(beta2 - 1.0), beta2);
  assert.strictEqual(snapBeta(beta2 - 1.4), beta2);
  // Points just outside second triple's window should not snap
  assert.strictEqual(snapBeta(beta2 - 1.6), beta2 - 1.6);
});

test('each triple can be snapped to from its respective window', () => {
  // Verify that every triple, including those not first in the list, snaps correctly.
  // This catches a mutation where snapBeta returns the first triple rather than nearest.
  for (let i = 0; i < TRIPLES.length; i++) {
    const beta = tripleBeta(TRIPLES[i]);
    // Test snap from below, within tolerance
    const result1 = snapBeta(beta - 0.8);
    assert.strictEqual(result1, beta,
                       `Triple ${i} at ${beta} should snap from ${beta - 0.8}`);
    // Test snap from above, within tolerance
    const result2 = snapBeta(beta + 0.9);
    assert.strictEqual(result2, beta,
                       `Triple ${i} at ${beta} should snap from ${beta + 0.9}`);
    // Test no snap when outside tolerance
    const result3 = snapBeta(beta + 1.6);
    assert.notStrictEqual(result3, beta,
                          `Triple ${i} should not snap from ${beta + 1.6}`);
  }
});

test('tripleAt returns the right triple at exact angle, null elsewhere', () => {
  for (let i = 0; i < TRIPLES.length; i++) {
    const beta = tripleBeta(TRIPLES[i]);
    const t = tripleAt(beta);
    assert.strictEqual(t, TRIPLES[i],
                       `tripleAt(${beta}) should return triple ${i}`);

    // Tenth of a degree away should return null
    assert.strictEqual(tripleAt(beta + 0.1), null,
                       `tripleAt(${beta + 0.1}) should return null`);
    assert.strictEqual(tripleAt(beta - 0.1), null,
                       `tripleAt(${beta - 0.1}) should return null`);
  }
});

test('clampBeta still pins at the new bounds 44 and 77', () => {
  assert.strictEqual(BETA_MIN, 44);
  assert.strictEqual(BETA_MAX, 77);
  assert.strictEqual(clampBeta(43), 44);
  assert.strictEqual(clampBeta(43.999), 44);
  assert.strictEqual(clampBeta(77), 77);
  assert.strictEqual(clampBeta(77.001), 77);
  assert.strictEqual(clampBeta(1000), 77);
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
