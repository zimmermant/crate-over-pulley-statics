import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, BETA_MIN, BETA_MAX } from '../src/physics.js';
import { TRI_VB, trianglePoints, fitTriangle } from '../src/triangle.js';

function snap(W, beta) { return { W, beta, ...solve({ W, beta }) }; }

test('the triangle closes at every reachable state', () => {
  for (const W of [100, 500, 600]) {
    for (let beta = BETA_MIN; beta <= BETA_MAX; beta += 0.5) {
      const p = trianglePoints(snap(W, beta));
      assert.strictEqual(p.length, 3);
      // Walking W, then T_BC, then T_BD must return to the start. The third leg
      // is implied by the first two plus closure, so this genuinely tests that
      // solve() satisfies both equilibrium equations.
      const s = snap(W, beta);
      const back = {
        x: p[2].x - s.TBD * Math.cos(s.theta * Math.PI / 180),
        y: p[2].y + s.TBD * Math.sin(s.theta * Math.PI / 180)
      };
      assert.ok(Math.hypot(back.x - p[0].x, back.y - p[0].y) < 1e-9,
                `triangle did not close at W=${W} beta=${beta}`);
    }
  }
});

test('the fitted triangle lands inside the panel with real margin', () => {
  for (const W of [100, 600]) {
    for (let beta = BETA_MIN; beta <= BETA_MAX; beta += 1) {
      const pts = trianglePoints(snap(W, beta));
      const { scale, offset } = fitTriangle(pts, TRI_VB);
      assert.ok(scale > 0 && Number.isFinite(scale));
      for (const q of pts) {
        const x = offset.x + q.x * scale;
        const y = offset.y - q.y * scale;
        assert.ok(x >= 0 && x <= TRI_VB.w, `x=${x} out of [0, ${TRI_VB.w}] at W=${W} beta=${beta}`);
        assert.ok(y >= 0 && y <= TRI_VB.h, `y=${y} out of [0, ${TRI_VB.h}] at W=${W} beta=${beta}`);
      }
    }
  }
});

test('the fit actually uses the panel rather than drawing a dot', () => {
  // Without this, a fitTriangle that returned scale = 0.0001 would pass the
  // containment test above while drawing nothing visible.
  const pts = trianglePoints(snap(500, 60));
  const { scale } = fitTriangle(pts, TRI_VB);
  const w = Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x));
  const h = Math.max(...pts.map(p => p.y)) - Math.min(...pts.map(p => p.y));
  const used = Math.max(w * scale / TRI_VB.w, h * scale / TRI_VB.h);
  assert.ok(used > 0.6, `fit only uses ${(used * 100).toFixed(0)}% of the panel`);
});

test('the fit is scale-invariant: doubling every force draws the same shape', () => {
  // Nothing about this problem changes shape with W, so the fitted triangle must
  // be pixel-identical between a light crate and a heavy one.
  const a = trianglePoints(snap(200, 55));
  const b = trianglePoints(snap(400, 55));
  const fa = fitTriangle(a, TRI_VB), fb = fitTriangle(b, TRI_VB);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs((fa.offset.x + a[i].x * fa.scale) - (fb.offset.x + b[i].x * fb.scale)) < 1e-6);
    assert.ok(Math.abs((fa.offset.y - a[i].y * fa.scale) - (fb.offset.y - b[i].y * fb.scale)) < 1e-6);
  }
});
