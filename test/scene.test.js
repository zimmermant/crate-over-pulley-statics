import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEG, BETA_MIN, BETA_MAX, BETA_SPECIAL, tripleBeta, solve } from '../src/physics.js';
import {
  SCENE_VB, CEIL_Y, ANCHOR_D, GROUND_Y, CRATE, ANCHOR_R,
  pulleyAt, anchorC, ropeBcXAt, betaFromPointerX, keyboardStep, slopeGlyph,
  interiorAngles
} from '../src/scene.js';

test('every reachable beta keeps the drawing inside the panel and clear of the crate', () => {
  // The ball-on-ramp app checked only the endpoints of its range, claimed it had
  // checked both, and shipped a geometry bug. This sweeps the whole domain, and
  // it is committed so it can be re-run after any constant changes.
  //
  // The pulley now hangs from the fixed ceiling anchor ANCHOR_D on a fixed-length
  // rope, so its position is DERIVED from theta and swings as beta changes -- the
  // crate, the arcs and the rope endpoints all follow it. Nothing here is a fixed
  // module-level point any more except ANCHOR_D and the ground/ceiling lines.
  const GAP = 12;
  const MARGIN = 20;
  for (let beta = BETA_MIN; beta <= BETA_MAX + 1e-9; beta += 0.25) {
    const theta = 45 + beta / 2;
    const pulley = pulleyAt(theta);
    const C = anchorC(beta);
    const crateR = pulley.x + CRATE.w / 2;
    const crateTop = pulley.y + CRATE.drop;
    const crateBot = crateTop + CRATE.h;

    assert.ok(ropeBcXAt(beta, crateTop) > crateR + GAP, `rope cuts the crate top at beta=${beta}`);
    assert.ok(ropeBcXAt(beta, crateBot) > crateR + GAP, `rope cuts the crate bottom at beta=${beta}`);

    assert.ok(C.x + ANCHOR_R < SCENE_VB.w, `anchor C past the right edge at beta=${beta}`);
    assert.ok(C.y === GROUND_Y, `anchor C left the ground at beta=${beta}`);
    assert.ok(C.x > pulley.x, `anchor C is not right of the pulley at beta=${beta}`);

    assert.ok(pulley.x - ANCHOR_R > 0, `pulley past the left edge at beta=${beta}`);
    assert.ok(pulley.x + ANCHOR_R < SCENE_VB.w, `pulley past the right edge at beta=${beta}`);
    assert.ok(pulley.y - ANCHOR_R > CEIL_Y, `pulley is not below the ceiling at beta=${beta}`);
    assert.ok(pulley.y + ANCHOR_R < SCENE_VB.h, `pulley past the bottom edge at beta=${beta}`);

    assert.ok(crateBot < GROUND_Y - MARGIN, `crate bottom is not clear of the ground at beta=${beta}`);
  }
});

test('ANCHOR_D is a fixed point on the ceiling and never moves', () => {
  assert.strictEqual(ANCHOR_D.y, CEIL_Y);
  assert.ok(ANCHOR_D.x - ANCHOR_R > 0 && ANCHOR_D.x + ANCHOR_R < SCENE_VB.w);
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

test('slopeGlyph is null off a detent and matches the measured construction on one', () => {
  assert.strictEqual(slopeGlyph(BETA_MIN), null);
  assert.strictEqual(slopeGlyph(60), null);

  // Expected vertex positions, measured against the geometry above at all four
  // detents (see task-b-report.md). Rounded to the nearest pixel.
  const expected = [
    { across: 3, down: 4,  hyp: 5,  p0: { x: 419, y: 487 }, p1: { x: 419, y: 524 }, p2: { x: 446, y: 524 } },
    { across: 8, down: 15, hyp: 17, p0: { x: 349, y: 490 }, p1: { x: 349, y: 531 }, p2: { x: 370, y: 531 } },
    { across: 5, down: 12, hyp: 13, p0: { x: 311, y: 493 }, p1: { x: 311, y: 535 }, p2: { x: 328, y: 535 } },
    { across: 7, down: 24, hyp: 25, p0: { x: 269, y: 496 }, p1: { x: 269, y: 540 }, p2: { x: 282, y: 540 } }
  ];

  for (const row of expected) {
    const beta = tripleBeta({ across: row.across, down: row.down, hyp: row.hyp });
    const glyph = slopeGlyph(beta);
    assert.ok(glyph, `expected a glyph at the ${row.across}-${row.down}-${row.hyp} detent`);
    assert.deepStrictEqual(glyph.triple, { across: row.across, down: row.down, hyp: row.hyp });
    for (const key of ['p0', 'p1', 'p2']) {
      assert.ok(Math.abs(glyph[key].x - row[key].x) < 0.6,
        `${row.across}-${row.down}-${row.hyp} ${key}.x = ${glyph[key].x}, expected ~${row[key].x}`);
      assert.ok(Math.abs(glyph[key].y - row[key].y) < 0.6,
        `${row.across}-${row.down}-${row.hyp} ${key}.y = ${glyph[key].y}, expected ~${row[key].y}`);
    }
    // The hypotenuse must always be exactly 46px, whatever the triple.
    const hyp = Math.hypot(glyph.p2.x - glyph.p0.x, glyph.p2.y - glyph.p0.y);
    assert.ok(Math.abs(hyp - 46) < 1e-9, `hypotenuse length drifted at ${row.across}-${row.down}-${row.hyp}`);
  }
});

test('interiorAngles returns 90 - beta and 90 - theta across the whole sweep', () => {
  for (let beta = BETA_MIN; beta <= BETA_MAX + 1e-9; beta += 0.25) {
    const theta = 45 + beta / 2;
    const { gamma, delta } = interiorAngles({ beta, theta });
    assert.strictEqual(gamma, 90 - beta, `gamma at beta=${beta}`);
    assert.strictEqual(delta, 90 - theta, `delta at beta=${beta}`);
  }
});

// Mutation proof (recorded in the final task report): temporarily changing
// interiorAngles' delta field to read `90 - s.beta` (i.e. the same expression as
// gamma) makes this test fail across the whole sweep, since the ratio collapses
// to 1 instead of 2.
test('delta is exactly gamma/2 at every reachable beta -- the bisector property the app teaches', () => {
  for (let beta = BETA_MIN; beta <= BETA_MAX + 1e-9; beta += 0.1) {
    const theta = 45 + beta / 2;
    const { gamma, delta } = interiorAngles({ beta, theta });
    assert.ok(Math.abs(delta - gamma / 2) < 1e-12,
      `delta=${delta} is not exactly gamma/2=${gamma / 2} at beta=${beta}`);
  }
});

// Mutation proof (recorded in the final task report): the same `delta = 90 -
// s.beta` mutation above also fails this test across the whole sweep, since
// 2*cos(delta) then no longer matches TBD/W. This ties the displayed angle to
// the force formula in equations.js's T_BD = 2W*cos(delta), not just to gamma.
test('2 * cos(delta) equals solve().TBD / W at every reachable beta', () => {
  for (const W of [100, 337, 600]) {
    for (let beta = BETA_MIN; beta <= BETA_MAX + 1e-9; beta += 0.1) {
      const theta = 45 + beta / 2;
      const { delta } = interiorAngles({ beta, theta });
      const { TBD } = solve({ W, beta });
      assert.ok(Math.abs(2 * Math.cos(delta * DEG) - TBD / W) < 1e-12,
        `2*cos(delta) vs TBD/W mismatch at W=${W} beta=${beta}`);
    }
  }
});
