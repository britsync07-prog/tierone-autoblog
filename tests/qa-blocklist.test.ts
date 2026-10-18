import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAuthorByline, checkBlocklist } from '../lib/pipeline/qa/blocklist';

test('checkBlocklist detects prohibited YMYL terms', () => {
  const taxSample = 'In this guide, we review how to claim a tax deduction for software purchases.';
  const resTax = checkBlocklist(taxSample);
  assert.equal(resTax.pass, false);
  assert.equal(resTax.category, 'tax');
  assert.ok(resTax.violatingTerms.length > 0);

  const creditSample = 'Use this prompt to repair credit and boost your credit score fast.';
  const resCredit = checkBlocklist(creditSample);
  assert.equal(resCredit.pass, false);
  assert.equal(resCredit.category, 'credit');

  const medicalSample = 'This AI tool provides a medical diagnosis and prescription dosage guide.';
  const resMedical = checkBlocklist(medicalSample);
  assert.equal(resMedical.pass, false);
  assert.equal(resMedical.category, 'health/medical');

  const cryptoSample = 'Follow our cryptocurrency signal and stock pick algorithm for guaranteed returns.';
  const resCrypto = checkBlocklist(cryptoSample);
  assert.equal(resCrypto.pass, false);
  assert.equal(resCrypto.category, 'finance/investment');
});

test('checkBlocklist passes clean tech / digital tools content', () => {
  const techSample =
    'This article benchmarks the top 5 AI coding assistants for TypeScript developers in 2026.';
  const res = checkBlocklist(techSample);
  assert.equal(res.pass, true);
  assert.equal(res.violatingTerms.length, 0);
});

test('checkAuthorByline validates real publisher and mandatory links', () => {
  // Valid post
  const validPost = `---
title: "Best AI Writing Tools"
author: "musfiqur-rahman-saimon"
---
Explore our tools. Learn more [about the author](/about) and review our [editorial process](/editorial-process).`;
  const resValid = checkAuthorByline(validPost);
  assert.equal(resValid.pass, true);
  assert.equal(resValid.reasons.length, 0);

  // Fake persona
  const fakeAuthorPost = `---
title: "Best AI Writing Tools"
author: "dr-john-fake-persona"
---
Check our [about](/about) and [editorial](/editorial-process).`;
  const resFake = checkAuthorByline(fakeAuthorPost);
  assert.equal(resFake.pass, false);
  assert.match(resFake.reasons[0], /Fabricated author persona/);

  // Missing editorial process link
  const missingLinks = `---
title: "Best AI Writing Tools"
---
Check out our [about](/about) page.`;
  const resMissing = checkAuthorByline(missingLinks);
  assert.equal(resMissing.pass, false);
  assert.match(resMissing.reasons[0], /editorial-process/);
});
