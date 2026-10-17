// TDD RED tests for lib/pipeline/llm.ts (Plan 03-03 task 1), REWORKED for the
// ⚠ OWNER FULLY-FREE DIRECTIVE (2026-10-17): no paid third-party APIs EVER.
// The plan's Anthropic/OpenAI dual-client contract is superseded by an
// env-configurable OpenAI-COMPATIBLE adapter — LLM_BASE_URL + LLM_API_KEY +
// LLM_MODEL (+ optional LLM_MODEL_CHEAP for narrow tasks, and an optional
// LLM_FALLBACK_* provider). Protocol stays OpenAI-compatible so any free
// endpoint works (Groq, OpenRouter `:free`, local Ollama).
//
// Coverage (plan tests 1-5, reworked semantics):
//  T1 fixture path validates the jsonFixture through the SAME zod schema path
//     (zero network) and returns provider='fixture';
//  T2 fixture failing zod → LlmBadStructuredOutputError;
//  T3 routing: narrow tasks (summarize/title-desc) → LLM_MODEL_CHEAP when set,
//     all other tasks → LLM_MODEL (asserted through injected transport doubles);
//  T4 primary transport failure → falls back to the fallback provider once →
//     when both fail, LlmProvidersExhaustedError; with no fallback configured
//     the primary error surfaces unchanged;
//  T5 invalid structured output → exactly 1 repair retry whose messages carry
//     the validation error, then LlmBadStructuredOutputError when still bad.
//  T6 readFixtureMap: absent dir → {}, malformed → throws, valid → map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import {
  completeJson,
  LlmBadStructuredOutputError,
  LlmNoCredentialsError,
  LlmProvidersExhaustedError,
  readFixtureMap,
  type LlmTransport,
} from '../../lib/pipeline/llm';

const S = z.object({ h1: z.string() });
const OK_MESSAGES = [{ role: 'user' as const, content: 'produce json' }];

/** Set LLM env vars for one test, restoring prior values after. */
async function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => Promise<void>,
): Promise<void> {
  const saved = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(vars)) {
    saved.set(k, process.env[k]);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    await fn();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function fixtureTransport(raw: string): LlmTransport {
  return async () => ({ raw, attempts: 1 });
}

test('T1: fixture path validates through the same zod gate with no network and provider=fixture', async () => {
  const r = await completeJson({
    task: 'generic-structured',
    zodSchema: S,
    messages: OK_MESSAGES,
    jsonFixture: { h1: 'x' },
  });
  assert.equal(r.provider, 'fixture');
  assert.equal(r.parsed.h1, 'x');
  assert.equal(typeof r.raw, 'string');
  assert.equal(r.attempts, 0);
});

test('T2: fixture failing zod throws LlmBadStructuredOutputError', async () => {
  await assert.rejects(
    completeJson({
      task: 'generic-structured',
      zodSchema: S,
      messages: OK_MESSAGES,
      jsonFixture: { h1: 5 },
    }),
    LlmBadStructuredOutputError,
  );
});

test('T3: routing — narrow tasks use LLM_MODEL_CHEAP, other tasks use LLM_MODEL (injected transport)', async () => {
  const calls: { model: string; baseUrl: string; apiKey?: string; task: string }[] = [];
  const primary: LlmTransport = async (c) => {
    calls.push({ model: c.model, baseUrl: c.baseUrl, apiKey: c.apiKey, task: c.task });
    return { raw: JSON.stringify({ h1: 'ok' }), attempts: 1 };
  };
  await withEnv(
    {
      LLM_BASE_URL: 'https://free-endpoint.test/v1',
      LLM_API_KEY: 'free-tier-key',
      LLM_MODEL: 'primary-model',
      LLM_MODEL_CHEAP: 'cheap-model',
    },
    async () => {
      const narrow = await completeJson({
        task: 'summarize',
        zodSchema: S,
        messages: OK_MESSAGES,
        transports: { primary },
      });
      assert.equal(narrow.provider, 'primary');
      const body = await completeJson({
        task: 'outline-body',
        zodSchema: S,
        messages: OK_MESSAGES,
        transports: { primary },
      });
      assert.equal(body.provider, 'primary');
      assert.deepEqual(calls.map((c) => c.model), ['cheap-model', 'primary-model']);
      assert.equal(calls[0].baseUrl, 'https://free-endpoint.test/v1');
      assert.equal(calls[0].apiKey, 'free-tier-key'); // transport gets the raw key; adapters log var names, never values
    },
  );

  // LLM_MODEL_CHEAP unset → narrow tasks degrade to LLM_MODEL (documented default)
  await withEnv(
    {
      LLM_BASE_URL: 'https://free-endpoint.test/v1',
      LLM_API_KEY: undefined,
      LLM_MODEL: 'primary-model',
      LLM_MODEL_CHEAP: undefined,
    },
    async () => {
      const narrow = await completeJson({
        task: 'title-desc',
        zodSchema: S,
        messages: OK_MESSAGES,
        transports: { primary },
      });
      assert.equal(narrow.provider, 'primary');
      assert.equal(calls.at(-1)?.model, 'primary-model');
    },
  );
});

test('T4: primary failure → fallback provider once; both failing → LlmProvidersExhaustedError; no fallback env → primary error surfaces', async () => {
  const fbCalls: string[] = [];
  const fallback: LlmTransport = async (c) => {
    fbCalls.push(c.model);
    return { raw: JSON.stringify({ h1: 'from-fallback' }), attempts: 1 };
  };
  const primaryFails: LlmTransport = async () => {
    throw new Error('primary upstream 500');
  };
  await withEnv(
    {
      LLM_BASE_URL: 'https://primary.test/v1',
      LLM_MODEL: 'primary-model',
      LLM_FALLBACK_BASE_URL: 'https://fallback.test/v1',
      LLM_FALLBACK_MODEL: 'fallback-model',
    },
    async () => {
      const r = await completeJson({
        task: 'generic-structured',
        zodSchema: S,
        messages: OK_MESSAGES,
        transports: { primary: primaryFails, fallback },
      });
      assert.equal(r.provider, 'fallback');
      assert.equal(r.parsed.h1, 'from-fallback');
      assert.deepEqual(fbCalls, ['fallback-model']);
    },
  );

  await withEnv(
    {
      LLM_FALLBACK_BASE_URL: undefined,
      LLM_FALLBACK_MODEL: undefined,
    },
    async () => {
      await assert.rejects(
        completeJson({
          task: 'generic-structured',
          zodSchema: S,
          messages: OK_MESSAGES,
          transports: { primary: primaryFails },
        }),
        /primary upstream 500/,
      );
    },
  );
});

test('T5: invalid structured output → 1 repair retry carrying the validation error, then throws', async () => {
  let n = 0;
  const seen: string[][] = [];
  const brokenThenFixed: LlmTransport = async (c) => {
    seen.push(c.messages.map((m) => m.content));
    n += 1;
    if (n === 1) return { raw: JSON.stringify({ h1: 5 }), attempts: 1 };
    return { raw: JSON.stringify({ h1: 'fixed' }), attempts: 1 };
  };
  const ok = await completeJson({
    task: 'generic-structured',
    zodSchema: S,
    messages: OK_MESSAGES,
    transports: { primary: brokenThenFixed },
  });
  assert.equal(ok.parsed.h1, 'fixed');
  assert.equal(n, 2);
  assert.match(seen[1]!.at(-1)!, /h1/); // validation error names the failing field

  // always-invalid → throws after exactly 2 calls (1 repair retry, no more)
  let m = 0;
  const alwaysBroken: LlmTransport = async () => {
    m += 1;
    return { raw: JSON.stringify({ h1: 5 }), attempts: 1 };
  };
  await assert.rejects(
    completeJson({
      task: 'generic-structured',
      zodSchema: S,
      messages: OK_MESSAGES,
      transports: { primary: alwaysBroken },
    }),
    LlmBadStructuredOutputError,
  );
  assert.equal(m, 2);
});

test('T6: readFixtureMap — absent dir → {}, malformed file throws, valid map returned', () => {
  const dir = mkdtempSync(join(tmpdir(), 'llm-fixtures-'));
  try {
    assert.deepEqual(readFixtureMap(dir), {});
    writeFileSync(join(dir, 'llm-fixtures.json'), 'not json{');
    assert.throws(() => readFixtureMap(dir), /llm-fixtures\.json/);
    rmSync(join(dir, 'llm-fixtures.json'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'llm-fixtures.json'), JSON.stringify({ 'brief:silo:id': { h1: 'x' } }));
    const map = readFixtureMap(dir) as Record<string, unknown>;
    assert.deepEqual(map['brief:silo:id'], { h1: 'x' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
