import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WEIGHT_MIN, WEIGHT_MAX } from '../src/physics.js';
import { createState } from '../src/state.js';
import { SCENE_VB } from '../src/scene.js';
import { FBD_VB } from '../src/fbd.js';
import { TRI_VB } from '../src/triangle.js';

// index.template.html hard-codes five values that also live as module
// constants -- the range/number inputs' min/max/value and the three panels'
// viewBox attributes -- because a <template> cannot import a JS constant.
// They currently agree, but nothing enforced that, and the template and the
// constants were written in separate tasks. These read the raw template
// source and assert each duplicated value against the constant it must track.

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'src', 'index.template.html'), 'utf8');

test('the weight inputs min/max match WEIGHT_MIN/WEIGHT_MAX', () => {
  assert.match(html, new RegExp(`id="w-range"[^>]*\\bmin="${WEIGHT_MIN}"`), 'w-range min');
  assert.match(html, new RegExp(`id="w-range"[^>]*\\bmax="${WEIGHT_MAX}"`), 'w-range max');
  assert.match(html, new RegExp(`id="w-number"[^>]*\\bmin="${WEIGHT_MIN}"`), 'w-number min');
  assert.match(html, new RegExp(`id="w-number"[^>]*\\bmax="${WEIGHT_MAX}"`), 'w-number max');
});

test('the weight inputs default value matches state.js\'s default W', () => {
  // state.js does not export the default -- read it off a fresh state instead
  // of duplicating the literal 500 here too.
  const defaultW = createState().getState().W;
  assert.match(html, new RegExp(`id="w-range"[^>]*\\bvalue="${defaultW}"`), 'w-range value');
  assert.match(html, new RegExp(`id="w-number"[^>]*\\bvalue="${defaultW}"`), 'w-number value');
});

test('the scene panel viewBox matches SCENE_VB', () => {
  assert.match(html, new RegExp(`id="scene-svg"[^>]*viewBox="0 0 ${SCENE_VB.w} ${SCENE_VB.h}"`));
});

test('the fbd panel viewBox matches FBD_VB', () => {
  assert.match(html, new RegExp(`id="fbd-svg"[^>]*viewBox="0 0 ${FBD_VB.w} ${FBD_VB.h}"`));
});

// Prove it bites (recorded in the final fix report): temporarily changing
// TRI_VB.w in triangle.js to 481 makes this test fail.
test('the triangle panel viewBox matches TRI_VB', () => {
  assert.match(html, new RegExp(`id="triangle-svg"[^>]*viewBox="0 0 ${TRI_VB.w} ${TRI_VB.h}"`));
});
