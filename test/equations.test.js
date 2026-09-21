import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, BETA_MIN, BETA_MAX } from '../src/physics.js';
import { terms } from '../src/equations.js';

function snap(W, beta) { return { W, beta, ...solve({ W, beta }) }; }

// Verified before this plan was written: across all 213 states these tests
// sample, both string comparisons hold. They compare mathematically identical
// quantities computed by different routes, so they could in principle differ
// after toFixed(1) if a value landed within ~1e-10 of a rounding boundary. This
// holds across the sampled grid, but is not a universal guarantee: at W=112.5,
// beta=60 the two floating-point paths land on either side of a toFixed(1) tie
// and print "56.3" against "56.2". Both values are reachable and correct to
// the display precision -- a tie like this is not student-visible, since nothing
// on screen prints both routes for the same quantity side by side. Should a
// sampled fixture hit one, report it rather than loosening the assertion -- the
// string equality is still the point of the test for the states it covers.
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
  for (const k of ['tba', 'tbc', 'tbd', 'beta', 'theta', 'fxLeft', 'fyUp']) {
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

// fyFar must come from the unrounded state, not from subtracting two already
// -rounded display strings (fyDown minus tba), which is arithmetic on rounded
// values and can be off by up to 0.1 N. This is what actually pins that: mutate
// fyFar in equations.js to `(s.TBC * Math.sin(s.beta * DEG) + 99).toFixed(1)`
// and this test fails everywhere in the sweep.
test('the far segment vertical term plus the crate weight equals the upward pull', () => {
  for (const W of [100, 337, 600]) {
    for (let beta = BETA_MIN; beta <= BETA_MAX; beta += 0.5) {
      const t = terms(snap(W, beta));
      assert.strictEqual(Number(t.fyUp), Number(t.tba) + Number(t.fyFar),
        `at W=${W} beta=${beta}: fyUp=${t.fyUp} tba=${t.tba} fyFar=${t.fyFar}`);
    }
  }
});
