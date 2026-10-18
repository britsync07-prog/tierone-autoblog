import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as indexNowRoute } from '../app/api/indexnow/route';
import { submitIndexNow } from '../lib/pipeline/indexing/indexnow';

test('IndexNow API Route: returns 404 when INDEXNOW_KEY env is not set', async () => {
  const origKey = process.env.INDEXNOW_KEY;
  delete process.env.INDEXNOW_KEY;
  try {
    const req = new Request('https://exclusivesources.online/api/indexnow?key=mytestkey123');
    const res = await indexNowRoute(req);
    assert.equal(res.status, 404);
  } finally {
    process.env.INDEXNOW_KEY = origKey;
  }
});

test('IndexNow API Route: returns 404 when requested key does not match INDEXNOW_KEY', async () => {
  const origKey = process.env.INDEXNOW_KEY;
  process.env.INDEXNOW_KEY = 'correctkey123456';
  try {
    const req = new Request('https://exclusivesources.online/api/indexnow?key=wrongkey999');
    const res = await indexNowRoute(req);
    assert.equal(res.status, 404);
  } finally {
    process.env.INDEXNOW_KEY = origKey;
  }
});

test('IndexNow API Route: returns 200 with plain-text key when key matches', async () => {
  const origKey = process.env.INDEXNOW_KEY;
  const testKey = 'testkeyabcdef1234567890';
  process.env.INDEXNOW_KEY = testKey;
  try {
    const req = new Request(`https://exclusivesources.online/api/indexnow?key=${testKey}`);
    const res = await indexNowRoute(req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.ok(res.headers.get('cache-control')?.includes('max-age=86400'));
    const body = await res.text();
    assert.equal(body, testKey);
  } finally {
    process.env.INDEXNOW_KEY = origKey;
  }
});

test('submitIndexNow: validates missing or invalid key', async () => {
  const origKey = process.env.INDEXNOW_KEY;
  delete process.env.INDEXNOW_KEY;
  try {
    const res = await submitIndexNow({
      siteUrl: 'https://exclusivesources.online',
      urlList: ['https://exclusivesources.online/blog/post-1'],
    });
    assert.equal(res.success, false);
    assert.equal(res.status, 'error');
    assert.ok(res.message?.includes('Invalid or missing IndexNow key'));
  } finally {
    process.env.INDEXNOW_KEY = origKey;
  }
});

test('submitIndexNow: validates empty urlList', async () => {
  const res = await submitIndexNow({
    siteUrl: 'https://exclusivesources.online',
    key: 'validkey12345678',
    urlList: [],
  });
  assert.equal(res.success, false);
  assert.equal(res.status, 'error');
  assert.ok(res.message?.includes('at least one URL'));
});

test('submitIndexNow: constructs valid payload and handles 200 / 202 responses', async () => {
  let capturedUrl = '';
  let capturedBody: any = null;

  const mockFetch: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ message: 'OK' }), { status: 200 });
  };

  const res = await submitIndexNow({
    siteUrl: 'https://exclusivesources.online',
    key: 'testkey1234567890',
    urlList: [
      'https://exclusivesources.online/blog/chatgpt-vs-claude',
      'https://exclusivesources.online/sitemap/0.xml',
    ],
    fetchFn: mockFetch,
  });

  assert.equal(res.success, true);
  assert.equal(res.status, 'submitted');
  assert.equal(res.httpStatus, 200);
  assert.equal(capturedUrl, 'https://api.indexnow.org/indexnow');
  assert.equal(capturedBody.host, 'exclusivesources.online');
  assert.equal(capturedBody.key, 'testkey1234567890');
  assert.equal(
    capturedBody.keyLocation,
    'https://exclusivesources.online/testkey1234567890.txt'
  );
  assert.deepEqual(capturedBody.urlList, [
    'https://exclusivesources.online/blog/chatgpt-vs-claude',
    'https://exclusivesources.online/sitemap/0.xml',
  ]);
});

test('submitIndexNow: handles 202 Accepted status', async () => {
  const mockFetch: typeof fetch = async () => {
    return new Response(null, { status: 202, statusText: 'Accepted' });
  };

  const res = await submitIndexNow({
    siteUrl: 'https://exclusivesources.online',
    key: 'testkey1234567890',
    urlList: ['https://exclusivesources.online/blog/sample'],
    fetchFn: mockFetch,
  });

  assert.equal(res.success, true);
  assert.equal(res.status, 'submitted');
  assert.equal(res.httpStatus, 202);
});

test('submitIndexNow: handles HTTP errors (403 Forbidden)', async () => {
  const mockFetch: typeof fetch = async () => {
    return new Response(null, { status: 403, statusText: 'Forbidden' });
  };

  const res = await submitIndexNow({
    siteUrl: 'https://exclusivesources.online',
    key: 'testkey1234567890',
    urlList: ['https://exclusivesources.online/blog/sample'],
    fetchFn: mockFetch,
  });

  assert.equal(res.success, false);
  assert.equal(res.status, 'error');
  assert.equal(res.httpStatus, 403);
  assert.ok(res.message?.includes('403'));
});

test('submitIndexNow: handles network error without throwing', async () => {
  const mockFetch: typeof fetch = async () => {
    throw new Error('Connection refused by peer');
  };

  const res = await submitIndexNow({
    siteUrl: 'https://exclusivesources.online',
    key: 'testkey1234567890',
    urlList: ['https://exclusivesources.online/blog/sample'],
    fetchFn: mockFetch,
  });

  assert.equal(res.success, false);
  assert.equal(res.status, 'error');
  assert.ok(res.message?.includes('Connection refused by peer'));
});
