import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateInformationGain,
  evaluateInformationGainDeterministic,
} from '../lib/pipeline/qa/info-gain';

test('evaluateInformationGain passes rich draft scoring >= 3', async () => {
  const richDraft = `
## Practical Workflow
Step 1: Set up your API key in environment variables.
\`\`\`bash
export AI_KEY="sk-..."
\`\`\`
Step 2: Initialize the client and run benchmark tests.

## Feature Comparison
| Feature | Tool A | Tool B |
|---|---|---|
| Pricing | $20/mo | Free tier |
| Context | 200k | 128k |

## Known Limitations and Tradeoffs
A major drawback of Tool A is latency under peak load. When not to use: avoiding vendor lock-in.

## Frequently Asked Questions
- Q: What are the best alternatives?
  A: For open-source setups, choose local models.
`;

  const { pass, result } = await evaluateInformationGain({
    draftBody: richDraft,
    evaluateViaLlm: false,
  });

  assert.equal(pass, true);
  assert.ok(result.totalScore >= 3, `Expected score >= 3, got ${result.totalScore}`);
  assert.equal(result.workflowGuidance.pass, true);
  assert.equal(result.comparisonSynthesis.pass, true);
  assert.equal(result.edgeCaseCoverage.pass, true);
  assert.equal(result.gapClosure.pass, true);
});

test('evaluateInformationGain fails thin draft scoring <= 2', async () => {
  const thinDraft = `
AI tools are very fast.
They help people write things.
You can use them for many things.
Some people like them.
`;

  const { pass, result } = await evaluateInformationGain({
    draftBody: thinDraft,
    evaluateViaLlm: false,
  });

  assert.equal(pass, false);
  assert.ok(result.totalScore < 3, `Expected score < 3, got ${result.totalScore}`);
  assert.match(result.summary, /Failed Information Gain rubric/);
});
