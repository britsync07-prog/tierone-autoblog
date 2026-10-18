import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crawlLinks, extractLinks } from '../lib/pipeline/qa/link-crawler';

test('extractLinks parses markdown links accurately', () => {
  const sample = `
# Sample Title
Here is a [valid link](/about) and an external [Google](https://google.com).
Image should not match: ![Hero Image](/images/hero.webp).
Another [Silo Link](/ai-writing#intro).
`;
  const links = extractLinks(sample);
  assert.equal(links.length, 3);
  assert.equal(links[0].url, '/about');
  assert.equal(links[0].isInternal, true);
  assert.equal(links[1].url, 'https://google.com');
  assert.equal(links[1].isInternal, false);
  assert.equal(links[2].url, '/ai-writing#intro');
  assert.equal(links[2].isInternal, true);
});

test('crawlLinks passes valid internal routes and detects 404 routes', async () => {
  const tmpDir = join(process.cwd(), 'tmp-test-link-posts');
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(join(tmpDir, 'existing-post.mdx'), '# Post', 'utf8');

  // Valid draft with known static routes and existing-post
  const validDraft = `
Read our [about](/about) and [editorial policy](/editorial-process).
Check out our [existing post](/posts/existing-post) or [silo hub](/ai-writing).
`;
  const resValid = await crawlLinks(validDraft, { postsDir: tmpDir, probeExternal: false });
  assert.equal(resValid.pass, true);
  assert.equal(resValid.brokenInternal.length, 0);

  // Invalid draft with hallucinated internal route
  const invalidDraft = `
Check out this [ghost article](/posts/non-existent-hallucinated-guide).
And [missing silo](/non-existent-hub).
`;
  const resInvalid = await crawlLinks(invalidDraft, { postsDir: tmpDir, probeExternal: false });
  assert.equal(resInvalid.pass, false);
  assert.equal(resInvalid.brokenInternal.length, 2);
  assert.ok(resInvalid.brokenInternal.includes('/posts/non-existent-hallucinated-guide'));
  assert.ok(resInvalid.brokenInternal.includes('/non-existent-hub'));

  rmSync(tmpDir, { recursive: true, force: true });
});

test('crawlLinks strips broken external links in sanitizedBody', async () => {
  // Use non-routable dummy domain or 404 URL
  const draftWithDeadLink = 'Visit [Bogus Link](https://this-domain-will-never-exist-12345.xyz) for details.';
  const res = await crawlLinks(draftWithDeadLink, {
    probeExternal: true,
    externalTimeoutMs: 1500,
  });

  assert.equal(res.brokenExternal.length, 1);
  assert.ok(res.sanitizedBody);
  assert.match(res.sanitizedBody, /Visit Bogus Link for details\./);
  assert.doesNotMatch(res.sanitizedBody, /\[Bogus Link\]/);
});
