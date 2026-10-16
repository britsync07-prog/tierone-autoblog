// Lighthouse CI guardrail (SITE-01): homepage + representative post template
// must hold Lighthouse 90+ mobile. Full per-post assertions arrive in Plan 04;
// this file must exist now so Plan 04 extends rather than retrofits.
module.exports = {
  ci: {
    collect: {
      // Homepage + representative post template (Plan 04): the seed post
      // exercises TL;DR, TOC, tables, code blocks, FAQ, and related-posts.
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/blog/best-ai-writing-assistants-2026',
      ],
      numberOfRuns: 3,
      startServerCommand: 'npm start',
      startServerReadyPattern: 'Ready in',
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
      },
    },
  },
};
