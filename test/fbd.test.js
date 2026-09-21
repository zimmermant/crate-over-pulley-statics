import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, BETA_MIN, BETA_MAX, WEIGHT_MIN, WEIGHT_MAX, DEG } from '../src/physics.js';
import { FBD_VB, FBD_ORIGIN, FBD_SCALE, arrowTip, magnitudeFromPointer } from '../src/fbd.js';

function snap(W, beta) {
  const d = solve({ W, beta });
  return { W, beta, ...d };
}

test('no arrow leaves the panel at any reachable state', () => {
  // T_BD is bounded by 2W here -- unlike the ball-on-ramp app, nothing runs away
  // -- so a fixed scale needs no clipping. This test is what licenses that.
  for (const W of [WEIGHT_MIN, 350, WEIGHT_MAX]) {
    for (let beta = BETA_MIN; beta <= BETA_MAX; beta += 0.5) {
      const s = snap(W, beta);
      for (const which of ['ab', 'bc', 'bd']) {
        const t = arrowTip(s, which);
        assert.ok(t.x > 20 && t.x < FBD_VB.w - 20, `${which} tip x=${t.x} at W=${W} beta=${beta}`);
        assert.ok(t.y > 20 && t.y < FBD_VB.h - 20, `${which} tip y=${t.y} at W=${W} beta=${beta}`);
      }
    }
  }
});

test('arrow directions match the physics', () => {
  const s = snap(500, 60);
  const ab = arrowTip(s, 'ab'), bc = arrowTip(s, 'bc'), bd = arrowTip(s, 'bd');
  assert.ok(Math.abs(ab.x - FBD_ORIGIN.x) < 1e-9, 'the crate pulls straight down');
  assert.ok(ab.y > FBD_ORIGIN.y, 'the crate pulls DOWN');
  assert.ok(bc.x > FBD_ORIGIN.x && bc.y > FBD_ORIGIN.y, 'T_BC pulls down and to the right');
  assert.ok(bd.x < FBD_ORIGIN.x && bd.y < FBD_ORIGIN.y, 'T_BD pulls up and to the left');
});

test('the three arrows sum to zero', () => {
  for (let beta = BETA_MIN; beta <= BETA_MAX; beta += 2.5) {
    const s = snap(500, beta);
    let sx = 0, sy = 0;
    for (const which of ['ab', 'bc', 'bd']) {
      const t = arrowTip(s, which);
      sx += t.x - FBD_ORIGIN.x;
      sy += t.y - FBD_ORIGIN.y;
    }
    assert.ok(Math.abs(sx) < 1e-9, `x components must cancel at beta=${beta}, got ${sx}`);
    assert.ok(Math.abs(sy) < 1e-9, `y components must cancel at beta=${beta}, got ${sy}`);
  }
});

test('a pointer on an arrow tip reads back that arrows magnitude', () => {
  for (const W of [150, 400, 600]) {
    for (let beta = BETA_MIN; beta <= BETA_MAX; beta += 5) {
      const s = snap(W, beta);
      for (const which of ['ab', 'bc', 'bd']) {
        const got = magnitudeFromPointer(arrowTip(s, which), which, s);
        const want = which === 'bd' ? s.TBD : W;
        assert.ok(Math.abs(got - want) < 1e-9, `${which} at W=${W} beta=${beta}: ${got} vs ${want}`);
      }
    }
  }
});

test('a pointer off the arrows line projects onto it rather than following freely', () => {
  const s = snap(500, 60);
  const tip = arrowTip(s, 'bd');
  // Step sideways, perpendicular to the BD direction. The magnitude must not change.
  const perp = { x: Math.sin(s.theta * DEG), y: -Math.cos(s.theta * DEG) };
  const off = { x: tip.x + 40 * perp.x, y: tip.y + 40 * perp.y };
  const got = magnitudeFromPointer(off, 'bd', s);
  assert.ok(Math.abs(got - s.TBD) < 1e-6, `perpendicular motion must not change magnitude, got ${got}`);
});

test('the longest reachable arrow still fits the fixed scale', () => {
  const s = snap(WEIGHT_MAX, BETA_MAX);
  assert.ok(s.TBD * FBD_SCALE < 250, `longest arrow is ${s.TBD * FBD_SCALE}px`);
  assert.ok(s.TBD * FBD_SCALE > 200, 'the scale should use most of the panel, not a sliver');
});
