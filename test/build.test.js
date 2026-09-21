import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { strip, scanForDuplicates } from '../build.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

// build.js only calls main() when it is the program node was invoked on (see
// its guard at the bottom), so importing it here to reach `strip` does not
// trigger a real build. These pin strip()'s two rewrites -- import/export
// removal and export-keyword stripping -- as a pure function, independent of
// the file system.

test('a single-line relative import is removed', () => {
  const src = "import { el, clear } from './svg.js';\nconst x = 1;\n";
  const out = strip(src);
  assert.ok(!out.includes('import'), out);
  assert.ok(out.includes('const x = 1;'));
});

test('a multi-line relative import is removed', () => {
  const src =
    "import { tipPosition, constraintLine,\n" +
    "         RAMP_MIN, RAMP_MAX } from './physics.js';\n" +
    "const y = 2;\n";
  const out = strip(src);
  assert.ok(!out.includes('import'), out);
  assert.ok(!out.includes('RAMP_MIN'), 'the wrapped second line must be dropped too');
  assert.ok(out.includes('const y = 2;'));
});

test('a single-line export { ... } block is removed', () => {
  const src = 'const a = 1;\nexport { a, b };\nconst c = 2;\n';
  const out = strip(src);
  assert.ok(!out.includes('export'), out);
  assert.ok(out.includes('const a = 1;'));
  assert.ok(out.includes('const c = 2;'));
});

test('export function / export const keep their declaration but lose the keyword', () => {
  const src = 'export function foo() {}\nexport const bar = 1;\n';
  const out = strip(src);
  assert.ok(!/\bexport\b/.test(out), out);
  assert.ok(out.includes('function foo() {}'));
  assert.ok(out.includes('const bar = 1;'));
});

// scanForDuplicates is the build's actual name-collision guard, run once per
// module against a Map shared across the whole build. These pin its four
// load-bearing behaviours.

test('a genuine cross-module duplicate throws and names both files', () => {
  const seen = new Map();
  scanForDuplicates('export const FOO = 1;\n', 'a.js', seen);
  assert.throws(
    () => scanForDuplicates('export function FOO() {}\n', 'b.js', seen),
    /Duplicate top-level name "FOO" in b\.js; already declared in a\.js/
  );
});

test('a column-0 destructuring declaration throws', () => {
  const seen = new Map();
  assert.throws(
    () => scanForDuplicates('export const { a, b } = obj;\n', 'weird.js', seen),
    /destructuring/i
  );
  assert.throws(
    () => scanForDuplicates('const [first] = list;\n', 'weird2.js', new Map()),
    /destructuring/i
  );
});

test('a multi-declarator statement throws, naming the file and the fix', () => {
  const seen = new Map();
  assert.throws(
    () => scanForDuplicates(
      'export const VB = { w: 480, h: 380 }, PAD = 0.12;\n', 'triangle.js', seen),
    /triangle\.js/
  );
  assert.throws(
    () => scanForDuplicates(
      'export const VB = { w: 480, h: 380 }, PAD = 0.12;\n', 'triangle.js', new Map()),
    /one name per statement/
  );
  // A single declarator whose initializer merely CONTAINS commas -- inside an
  // object literal, an array, a call's argument list, or a trailing comment --
  // must not be mistaken for a second declarator.
  assert.doesNotThrow(() =>
    scanForDuplicates('export const COLORS = { t1: \'a\', t2: \'b\' };\n', 'svg.js', new Map()));
  assert.doesNotThrow(() =>
    scanForDuplicates('export const MODULES = [\'a.js\', \'b.js\'];\n', 'build.js', new Map()));
  assert.doesNotThrow(() =>
    scanForDuplicates('export const R = Math.hypot(A, B);\n', 'scene.js', new Map()));
  assert.doesNotThrow(() =>
    scanForDuplicates(
      'export const CONTACT_D = 250;  // ball contact, measured along the ramp\n',
      'scene.js', new Map()));
});

test('an ordinary indented function-local const does NOT throw -- the column-0 ' +
     'anchoring that lets a module\'s inner name legally shadow another module\'s top-level one',
  () => {
    const seen = new Map();
    const code = [
      'export function createTriangle(svg) {',
      '  function render(s) {',
      '    const px = (x, y) => ({ x: x, y: y });',
      '    return px(1, 2);',
      '  }',
      '  return { render };',
      '}'
    ].join('\n');
    assert.doesNotThrow(() => scanForDuplicates(code, 'triangle.js', seen));
    // the indented `const px` must never have been registered as a top-level name
    assert.ok(!seen.has('px'));
  });

test('the real fbd.js (top-level px) and triangle.js (indented, function-local px) ' +
     'do not collide', () => {
  const seen = new Map();
  scanForDuplicates(readFileSync(join(SRC, 'fbd.js'), 'utf8'), 'fbd.js', seen);
  assert.equal(seen.get('px'), 'fbd.js');
  assert.doesNotThrow(() =>
    scanForDuplicates(readFileSync(join(SRC, 'triangle.js'), 'utf8'), 'triangle.js', seen));
});
