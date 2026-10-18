// Deterministic Topic Blocklist & Author Byline Validator (D-06, Plan 04-02).
//
// Blocks YMYL topics (tax, banking, credit, prescription medical, investment advice)
// via fast pre-compiled regex matching before any LLM calls are made.
// Also validates author schema (musfiqur-rahman-saimon) and links to
// /about and /editorial-process.

export interface BlocklistResult {
  pass: boolean;
  violatingTerms: string[];
  category?: string;
}

export interface BylineResult {
  pass: boolean;
  reasons: string[];
}

interface BlocklistCategory {
  category: string;
  patterns: RegExp[];
}

const CATEGORIES: BlocklistCategory[] = [
  {
    category: 'tax',
    patterns: [
      /\b(tax (return|deduction|credit|bracket|loophole|write-?off)|irs filing|write off expenses|file taxes|tax evasion|tax refund)\b/i,
    ],
  },
  {
    category: 'banking',
    patterns: [
      /\b(bank account|checking account|wire transfer|routing number|swift code|open a bank|savings account APY|deposit insurance)\b/i,
    ],
  },
  {
    category: 'credit',
    patterns: [
      /\b(credit score|repair credit|fix credit|fico score|credit bureau|boost your credit score|credit report dispute)\b/i,
    ],
  },
  {
    category: 'health/medical',
    patterns: [
      /\b(medical diagnosis|prescription dosage|cure disease|treat symptom|fda approved drug|dosage guide|cure for cancer)\b/i,
    ],
  },
  {
    category: 'finance/investment',
    patterns: [
      /\b(stock pick|buy stock|investment advice|guaranteed return|cryptocurrency signal|crypto pumps|day trading strategy|forex signals)\b/i,
    ],
  },
];

/**
 * Scans text against all forbidden YMYL categories (D-06).
 * Fails fast and deterministically.
 */
export function checkBlocklist(text: string): BlocklistResult {
  const violatingTerms: string[] = [];
  let detectedCategory: string | undefined;

  for (const cat of CATEGORIES) {
    for (const pat of cat.patterns) {
      const match = pat.exec(text);
      if (match) {
        violatingTerms.push(match[0]);
        if (!detectedCategory) {
          detectedCategory = cat.category;
        }
      }
    }
  }

  if (violatingTerms.length > 0) {
    return {
      pass: false,
      violatingTerms,
      category: detectedCategory,
    };
  }

  return {
    pass: true,
    violatingTerms: [],
  };
}

const AUTHOR_NAME = 'musfiqur-rahman-saimon';

function parseFrontmatter(raw: string): { fm: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return { fm: {}, body: raw };
  const [, fmBlock, body] = match;
  const fm: Record<string, string> = {};

  for (const line of fmBlock.split('\n')) {
    const m = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (m) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      fm[m[1]] = v;
    }
  }

  return { fm, body };
}

/**
 * Validates author attribution and EEAT disclosure links (D-06).
 * Ensures author is musfiqur-rahman-saimon and body includes links to
 * /about and /editorial-process.
 */
export function checkAuthorByline(rawMdx: string): BylineResult {
  const reasons: string[] = [];
  const { fm, body } = parseFrontmatter(rawMdx);

  // If author is explicitly defined in frontmatter, it must match real publisher
  if (fm.author && fm.author.toLowerCase() !== AUTHOR_NAME) {
    reasons.push(
      `Fabricated author persona '${fm.author}' detected (must be '${AUTHOR_NAME}' or omitted)`,
    );
  }

  // Must include /about link
  if (!body.includes('/about')) {
    reasons.push('Missing required link to /about author/publisher profile');
  }

  // Must include /editorial-process link
  if (!body.includes('/editorial-process')) {
    reasons.push('Missing required link to /editorial-process AI-assistance disclosure');
  }

  return {
    pass: reasons.length === 0,
    reasons,
  };
}
