// TDD RED tests for scripts/check-template.mjs (Plan 03-06 task 1): the
// zero-dep landed-post template gate in the check-seeds/check-registry family
// idiom ("N passed" + exit 0/1 + precise `file: FAIL (rule)` lines).
//
// Coverage (plan task-1 behavior):
//  T1 default corpus run → every content/posts file (5 seeds incl. the 03-04
//     comparison retrofit) passes; prints "N passed"; exit 0;
//  T2 GOOD fixture dir → exit 0 ("1 passed");
//  T3 bad-meta fixture (description 145 chars) → exit 1, FAIL names description;
//  T4 bad-faq fixture (2 q/a pairs) → exit 1, FAIL names faq;
//  T5 bad-banned fixture (body contains 'delve') → exit 1, FAIL names the phrase;
//  T6 bad-h1 fixture (body has a `# Heading` line) → exit 1, FAIL names the H1 rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const GATE = resolve(ROOT, 'scripts', 'check-template.mjs');
const FIX = resolve(ROOT, 'test', 'fixtures', 'pipeline', 'template-fixtures');

function run(...args: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [GATE, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? '') };
}

test('T1: default corpus — every content/posts file passes, prints "N passed", exit 0', () => {
  const r = run();
  assert.equal(r.status, 0, `gate failed on the real corpus:\n${r.stdout}${r.stderr}`);
  const last = (r.stdout ?? '').trim().split('\n').at(-1) ?? '';
  const m = /^(\d+) passed$/.exec(last.trim());
  assert.ok(m, `expected a trailing "N passed" line, got "${last}"`);
  const corpus = r.stdout.split('\n').filter((l: string) => l.includes(': PASS')).length;
  assert.equal(corpus, Number(m![1]));
  assert.ok(Number(m![1]) >= 5, `expected >=5 seed files counted, got ${m![1]}`);
});

test('T2: good-draft fixture dir → exit 0 with "1 passed"', () => {
  const r = run(join(FIX, 'good-draft'));
  assert.equal(r.status, 0, `GOOD fixture should pass:\n${r.stdout}${r.stderr}`);
  assert.ok(/1 passed/.test(r.stdout ?? ''), `expected "1 passed", got "${r.stdout}"`);
});

test('T3: bad-meta fixture (description 145) → exit 1, FAIL line names description', () => {
  const r = run(join(FIX, 'bad-meta'));
  assert.equal(r.status, 1);
  assert.match(r.stdout ?? '', /FAIL/);
  assert.match(r.stdout ?? '', /description/);
});

test('T4: bad-faq fixture (2 q/a pairs) → exit 1, FAIL line names faq', () => {
  const r = run(join(FIX, 'bad-faq'));
  assert.equal(r.status, 1);
  assert.match(r.stdout ?? '', /FAIL/);
  assert.match(r.stdout ?? '', /faq/i);
});

test('T5: bad-banned fixture (body contains "delve") → exit 1, FAIL names the phrase', () => {
  const r = run(join(FIX, 'bad-banned'));
  assert.equal(r.status, 1);
  assert.match(r.stdout ?? '', /FAIL/);
  assert.match(r.stdout ?? '', /delve/);
});

test('T6: bad-h1 fixture (body has a "# Heading" line) → exit 1, FAIL names the H1 rule', () => {
  const r = run(join(FIX, 'bad-h1'));
  assert.equal(r.status, 1);
  assert.match(r.stdout ?? '', /FAIL/);
  assert.match(r.stdout ?? '', /H1/);
});
