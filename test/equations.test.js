import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, BETA_MIN, BETA_MAX } from '../src/physics.js';
import { terms } from '../src/equations.js';

function snap(W, beta) { return { W, beta, ...solve({ W, beta }) }; }

// Verified before this plan was written: across all 213 states these tests
// sample, both string comparisons hold. They compare mathematically identical
// quantities computed by different routes, so they could in principle differ
// after toFixed(1) if a value landed within ~1e-10 of a rounding boundary. That
// is deterministic, not flaky: if it passes once it passes always. Should you
// hit it, report it rather than loosening the assertion -- the string equality
// is the point of the test.
test('the two horizontal terms agree to the displayed precision', () => {
  // This is the whole reason terms() computes from the unrounded state. If the
  // forces were rounded first and the products taken afterwards, these two would
  // disagree in the last digit right next to a printed "= 0".
  for (const W of [100, 337, 600]) {
    for (let beta = BETA_MIN; beta <= BETA_MAX; beta += 0.5) {
      const t = terms(snap(W, beta));
      assert.strictEqual(t.fxLeft, t.fxRight, `at W=${W} beta=${beta}`);
    }
  }
});

test('the vertical terms balance to the displayed precision', () => {
  for (const W of [100, 337, 600]) {
    for (let beta = BETA_MIN; beta <= BETA_MAX; beta += 0.5) {
      const t = terms(snap(W, beta));
      assert.strictEqual(t.fyUp, t.fyDown, `at W=${W} beta=${beta}`);
    }
  }
});

test('terms are formatted to one decimal place', () => {
  const t = terms(snap(500, 60));
  for (const k of ['tab', 'tbc', 'tbd', 'beta', 'theta', 'fxLeft', 'fyUp']) {
    assert.match(t[k], /^-?\d+\.\d$/, `${k} was "${t[k]}"`);
  }
});

test('the textbook case prints the expected numbers', () => {
  const t = terms(snap(500, 67.38013505195958));
  assert.strictEqual(t.tbd, '980.6');
  assert.strictEqual(t.theta, '78.7');
  assert.strictEqual(t.beta, '67.4');
  assert.strictEqual(t.fxLeft, '192.3');
});
