import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractClaimsDeterministic,
  sanitizeDraftClaims,
  verifyClaims,
} from '../lib/pipeline/qa/fact-check';

test('extractClaimsDeterministic extracts statistics and detects fluff', () => {
  const text = `
According to Gartner (2025), over 65% of enterprise software developers utilize generative AI tools.
This tool is universally acknowledged as the single best code assistant on the market.
Pricing starts at $20 per seat per month.
`;
  const extracted = extractClaimsDeterministic(text);
  assert.equal(extracted.stats.length, 2);
  assert.equal(extracted.stats[0].numericalValue, '65%');
  assert.equal(extracted.stats[0].sourceCited, 'Gartner');
  assert.equal(extracted.stats[0].yearOrAsOf, '2025');

  assert.equal(extracted.fluffStatements.length, 1);
  assert.match(extracted.fluffStatements[0], /universally acknowledged/);
});

test('sanitizeDraftClaims cleanly excises fluff statements from prose', () => {
  const text = `
First paragraph with accurate facts.
This tool is universally acknowledged as the single best solution ever created.
Second paragraph with detailed benchmarks.
`;
  const fluff = ['This tool is universally acknowledged as the single best solution ever created.'];
  const sanitized = sanitizeDraftClaims(text, fluff);
  assert.ok(!sanitized.includes('universally acknowledged'));
  assert.ok(sanitized.includes('First paragraph'));
  assert.ok(sanitized.includes('Second paragraph'));
});

test('verifyClaims passes sourced statistics and flags unattributed statistics', async () => {
  // Sourced stat passes
  const validDraft = 'According to GitHub (2024), 92% of US developers use AI tools daily.';
  const resValid = await verifyClaims({ draftBody: validDraft, extractViaLlm: false });
  assert.equal(resValid.pass, true);
  assert.equal(resValid.criticalFailures.length, 0);
  assert.equal(resValid.unverifiedStats.length, 0);

  // Floating unattributed stat fails citation rule
  const floatingStatDraft = 'Around 45% of engineers reported significant productivity increases.';
  const resFloating = await verifyClaims({ draftBody: floatingStatDraft, extractViaLlm: false });
  assert.equal(resFloating.pass, false);
  assert.ok(resFloating.unverifiedStats.length > 0);
  assert.match(resFloating.unverifiedStats[0], /missing named source/);
});

test('verifyClaims detects planted false statistic (Red-Team Vector 1)', async () => {
  // Planted false stat: 78% of all code was written by AI in 1994
  const falseStatDraft = `
In 1994, 78% of all enterprise software code was created autonomously by AI assistants.
Learn more [about](/about) and review our [editorial process](/editorial-process).
`;
  const res = await verifyClaims({ draftBody: falseStatDraft, extractViaLlm: false });
  assert.equal(res.pass, false);
  assert.ok(res.criticalFailures.length > 0);
  assert.match(res.criticalFailures[0], /Planted false statistic detected/);
  assert.match(res.criticalFailures[0], /1990s/);
});
