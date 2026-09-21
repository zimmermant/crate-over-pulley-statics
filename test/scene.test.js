import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BETA_MIN, BETA_MAX, BETA_SPECIAL, solve } from '../src/physics.js';
import {
  SCENE_VB, PULLEY, GROUND_Y, CRATE, ANCHOR_R,
  anchorC, anchorD, betaFromPointerX, ropeBcXAt, keyboardStep
} from '../src/scene.js';

test('every reachable beta keeps the drawing inside the panel and clear of the crate', () => {
  // The ball-on-ramp app checked only the endpoints of its range, claimed it had
  // checked both, and shipped a geometry bug. This sweeps the whole domain, and
  // it is committed so it can be re-run after any constant changes.
  const crateR = PULLEY.x + CRATE.w / 2;
  const crateBot = CRATE.top + CRATE.h;
  const GAP = 12;
  for (let beta = BETA_MIN; beta <= BETA_MAX + 1e-9; beta += 0.25) {
    const theta = solve({ W: 500, beta }).theta;
    const C = anchorC(beta), D = anchorD(theta);
    assert.ok(ropeBcXAt(beta, CRATE.top) > crateR + GAP, `rope cuts the crate top at beta=${beta}`);
    assert.ok(ropeBcXAt(beta, crateBot) > crateR + GAP, `rope cuts the crate bottom at beta=${beta}`);
    assert.ok(C.x + ANCHOR_R < SCENE_VB.w, `anchor C past the right edge at beta=${beta}`);
    assert.ok(C.y === GROUND_Y, `anchor C left the ground at beta=${beta}`);
    assert.ok(D.x - ANCHOR_R > 0, `anchor D past the left edge at beta=${beta}`);
    assert.ok(D.y - ANCHOR_R > 0, `anchor D past the top edge at beta=${beta}`);
    assert.ok(D.x < PULLEY.x, `anchor D is not left of the pulley at beta=${beta}`);
    assert.ok(D.y < PULLEY.y, `anchor D is not above the pulley at beta=${beta}`);
  }
});

test('the crate hangs clear of the ground', () => {
  assert.ok(CRATE.top + CRATE.h < GROUND_Y - 20);
});

test('pointer x and beta round-trip through the ground line', () => {
  for (let beta = BETA_MIN; beta <= BETA_MAX; beta += 0.5) {
    const back = betaFromPointerX(anchorC(beta).x);
    assert.ok(Math.abs(back - beta) < 1e-9, `round trip failed at beta=${beta}`);
  }
});

test('dragging C to the right lowers beta and dragging it left raises beta', () => {
  const mid = anchorC(60).x;
  assert.ok(betaFromPointerX(mid + 60) < 60);
  assert.ok(betaFromPointerX(mid - 60) > 60);
});

test('the keyboard contract rounds to a whole degree before stepping', () => {
  // scene.js must round the CURRENT value before applying the step, or arrow
  // keys leaving the detent would walk on a 67.38/68.38/69.38 grid forever.
  assert.strictEqual(keyboardStep(BETA_SPECIAL, 1, false), 68);
  assert.strictEqual(keyboardStep(BETA_SPECIAL, -1, false), 66);
  assert.strictEqual(keyboardStep(68, 1, false), 69);
  assert.strictEqual(keyboardStep(52.4, -1, false), 51);
  // 60.6 rounds up to 61 (Math.round), but floors down to 60 (Math.floor) --
  // this fixture is the one that actually distinguishes the two, unlike the
  // four above it, whose fractional parts all sit below .5.
  assert.strictEqual(keyboardStep(60.6, 1, false), 62);
});

test('the keyboard contract does not round under Shift, so fine adjustment survives', () => {
  // If Shift rounded too, the exact-value path arrow keys need for a 0.1 degree
  // step would be lost the moment the value left a whole degree.
  assert.strictEqual(keyboardStep(BETA_SPECIAL, 0.1, true), BETA_SPECIAL + 0.1);
});
