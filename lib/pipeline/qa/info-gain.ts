// 4-Point Information Gain Evaluator (D-08, Plan 04-05).
//
// Evaluates draft content against 4 distinct value dimensions:
// 1. Unique workflow guidance (actionable, step-by-step procedure beyond generic bullet points)
// 2. Structured comparison synthesis (clear tradeoff analysis, pricing/feature matrices)
// 3. Edge-case and limitation coverage (honest drawbacks, when NOT to use, gotchas)
// 4. Competitor gap closure (directly answers searcher pain points omitted by SERP competitors)
//
// A draft must score >= 3 out of 4 to pass. Failure (score <= 2) triggers quarantine.

import { z } from 'zod';
import { completeJson, isLlmConfigured, type LlmMessage } from '../llm';

export const infoGainDimensionSchema = z.object({
  pass: z.boolean(),
  reasoning: z.string(),
});

export const infoGainSchema = z.object({
  workflowGuidance: infoGainDimensionSchema,
  comparisonSynthesis: infoGainDimensionSchema,
  edgeCaseCoverage: infoGainDimensionSchema,
  gapClosure: infoGainDimensionSchema,
  totalScore: z.number().int().min(0).max(4),
  summary: z.string(),
});

export type InfoGainResult = z.infer<typeof infoGainSchema>;

export interface EvaluateInfoGainOptions {
  draftBody: string;
  briefContent?: string;
  serpSnippets?: string[];
  fixture?: InfoGainResult;
  evaluateViaLlm?: boolean;
}

/**
 * Deterministic heuristic evaluator for offline testing and fast verification.
 */
export function evaluateInformationGainDeterministic(body: string): InfoGainResult {
  // Dimension 1: Unique workflow guidance (step-by-step procedures, code blocks, numbered instructions)
  const hasStepByStep = /(?:step\s*\d+:|^\s*\d+\.\s+\*\*|\bworkflow\b|```[a-z]*\n[\s\S]+?```)/im.test(body);
  const workflowGuidance = {
    pass: hasStepByStep,
    reasoning: hasStepByStep
      ? 'Provides concrete step-by-step instructions and technical workflow guidance.'
      : 'Lacks actionable step-by-step procedures or workflow demonstrations.',
  };

  // Dimension 2: Structured comparison synthesis (tables, tradeoff matrices)
  const hasComparison = /\|[\s-:]+\|[\s-:]+\|/m.test(body) || /<ComparisonTable/i.test(body);
  const comparisonSynthesis = {
    pass: hasComparison,
    reasoning: hasComparison
      ? 'Synthesizes tool differences in structured comparison tables.'
      : 'Fails to provide structured feature or pricing comparison matrices.',
  };

  // Dimension 3: Edge-case & limitation coverage (honest caveats, tradeoffs, when not to use)
  const hasEdgeCases = /\b(limitations?|drawbacks?|trade-?offs?|when not to use|cons|cautions?|gotchas?)\b/i.test(body);
  const edgeCaseCoverage = {
    pass: hasEdgeCases,
    reasoning: hasEdgeCases
      ? 'Provides explicit analysis of tool drawbacks and edge-case limitations.'
      : 'Omits drawbacks, edge cases, and honest failure modes.',
  };

  // Dimension 4: Competitor gap closure (FAQ section addressing user pain points, deep analysis)
  const hasGapClosure = /(?:^##\s+.*(?:faq|frequently asked|questions)|^\s*-\s*q\s*:)/im.test(body);
  const gapClosure = {
    pass: hasGapClosure,
    reasoning: hasGapClosure
      ? 'Closes competitor gaps with dedicated FAQ problem-solving sections.'
      : 'Fails to resolve deeper user search queries omitted by competitors.',
  };

  const dimensions = [workflowGuidance, comparisonSynthesis, edgeCaseCoverage, gapClosure];
  const totalScore = dimensions.filter((d) => d.pass).length;

  return {
    workflowGuidance,
    comparisonSynthesis,
    edgeCaseCoverage,
    gapClosure,
    totalScore,
    summary:
      totalScore >= 3
        ? `Passed Information Gain rubric with ${totalScore}/4 dimensions satisfied.`
        : `Failed Information Gain rubric: scored ${totalScore}/4 (requires >= 3/4).`,
  };
}

/**
 * Evaluates draft against the 4-point Information Gain rubric (D-08).
 */
export async function evaluateInformationGain(
  options: EvaluateInfoGainOptions,
): Promise<{ pass: boolean; result: InfoGainResult }> {
  if (options.fixture) {
    const result = infoGainSchema.parse(options.fixture);
    return { pass: result.totalScore >= 3, result };
  }

  const useLlm = options.evaluateViaLlm ?? isLlmConfigured();
  if (!useLlm || process.env.QA_FIXTURE === '1') {
    const result = evaluateInformationGainDeterministic(options.draftBody);
    return { pass: result.totalScore >= 3, result };
  }

  const messages: LlmMessage[] = [
    {
      role: 'system',
      content: `You are an expert search quality auditor evaluating an article against Google's Information Gain framework.
Score the draft on 4 distinct dimensions:
1. workflowGuidance: Does it provide hands-on, step-by-step procedures beyond generic bullet points? (pass: true/false, reasoning: string)
2. comparisonSynthesis: Does it provide structured tradeoff analysis or feature/pricing tables? (pass: true/false, reasoning: string)
3. edgeCaseCoverage: Does it candidly explore edge cases, drawbacks, and when NOT to use the tools? (pass: true/false, reasoning: string)
4. gapClosure: Does it answer searcher pain points omitted by generic top-3 SERP articles? (pass: true/false, reasoning: string)

totalScore must be the exact count of dimensions with pass === true (integer 0-4).
Return JSON matching the schema.`,
    },
    {
      role: 'user',
      content: `Draft Body:\n${options.draftBody.slice(0, 8000)}\n\nBrief Context / Competitor Gaps:\n${options.briefContent?.slice(0, 2000) ?? 'N/A'}`,
    },
  ];

  try {
    const res = await completeJson({
      task: 'generic-structured',
      zodSchema: infoGainSchema,
      messages,
    });
    return { pass: res.parsed.totalScore >= 3, result: res.parsed };
  } catch {
    const result = evaluateInformationGainDeterministic(options.draftBody);
    return { pass: result.totalScore >= 3, result };
  }
}
