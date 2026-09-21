import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, BETA_MIN, BETA_MAX } from '../src/physics.js';
import { sceneLabels } from '../src/scene.js';
import { fbdLabels } from '../src/fbd.js';
import { triangleLabels } from '../src/triangle.js';
import { terms } from '../src/equations.js';
import { forceParts, partsToString } from '../src/svg.js';

// Acceptance criterion 5 is "the scene, FBD, triangle and equations panels
// never disagree about any value." Each renderer used to build its force
// labels inline, so nothing stopped one of them from quietly labelling the
// wrong force. sceneLabels/fbdLabels/triangleLabels are the pure functions
// each renderer now calls instead of building strings itself, so this test
// covers exactly what each renderer will draw, without a DOM.

function snap(W, beta) { return { W, beta, ...solve({ W, beta }) }; }

function numFromLabel(label) {
  const m = /=\s*(-?\d+(?:\.\d+)?)/.exec(partsToString(label));
  if (!m) throw new Error(`no number found in label "${label}"`);
  return Number(m[1]);
}

// Mutation proof (recorded in the final fix report): temporarily changing
// triangleLabels' tbd field to read `Math.round(s.TBC)` instead of
// `Math.round(s.TBD)` makes both tests below fail across the whole sweep.
test('the scene, FBD and triangle panels never disagree on a force label', () => {
  for (const W of [100, 337, 600]) {
    for (let beta = BETA_MIN; beta <= BETA_MAX; beta += 1) {
      const s = snap(W, beta);
      const sc = sceneLabels(s), fb = fbdLabels(s), tr = triangleLabels(s);
      for (const key of ['tba', 'tbc', 'tbd']) {
        assert.deepStrictEqual(sc[key], fb[key], `${key} scene vs fbd at W=${W} beta=${beta}`);
        assert.deepStrictEqual(sc[key], tr[key], `${key} scene vs triangle at W=${W} beta=${beta}`);
      }
    }
  }
});

test('each panel force label matches the equations panel to 1 dp', () => {
  // The panels round to the nearest whole newton and the equations panel
  // rounds to 1 dp, so the two display precisions can legitimately differ by
  // up to about half a newton; the tolerance here is set just above that, far
  // below the tens-to-hundreds-of-newtons gap a mislabelled force would show.
  for (const W of [100, 337, 600]) {
    for (let beta = BETA_MIN; beta <= BETA_MAX; beta += 1) {
      const s = snap(W, beta);
      const t = terms(s);
      const sc = sceneLabels(s);
      for (const key of ['tba', 'tbc', 'tbd']) {
        const labelValue = numFromLabel(sc[key]);
        const eqValue = Number(t[key]);
        assert.ok(Math.abs(labelValue - eqValue) < 0.6,
          `${key} label=${labelValue} equations=${eqValue} at W=${W} beta=${beta}`);
      }
    }
  }
});

// Mutation proof: dropping the `typeof p === 'object'` guard from isSubPart --
// i.e. testing `p.sub !== undefined`, which looks equivalent -- makes every
// plain string match, because String.prototype.sub is a real legacy method on
// every string. partsToString then returns
// "_function sub() { [native code] }_BA_..." and this test fails.
test('a force label separates its subscript from the rest of the text', () => {
  const parts = forceParts('BA', 500);
  assert.deepStrictEqual(parts, ['T', { sub: 'BA' }, ' = 500 N']);
  assert.strictEqual(partsToString(parts), 'T_BA = 500 N');
  assert.strictEqual(partsToString('W = 500 N'), 'W = 500 N');
});

// Mutation proof: swapping any one panel's subscript (e.g. triangleLabels'
// tba to forceParts('AB', ...)) fails here, where the cross-panel agreement
// test above would still pass if all three were swapped together.
test('every panel subscripts each force with the pair of points it runs between', () => {
  const s = snap(500, 60);
  for (const labels of [sceneLabels(s), fbdLabels(s), triangleLabels(s)]) {
    for (const [key, expected] of [['tba', 'BA'], ['tbc', 'BC'], ['tbd', 'BD']]) {
      const [head, subPart] = labels[key];
      assert.strictEqual(head, 'T', `${key} should lead with T`);
      assert.deepStrictEqual(subPart, { sub: expected }, `${key} subscript`);
    }
  }
});
