// Lighthouse CI guardrail (SITE-01): homepage + representative post template
// must hold Lighthouse 90+ mobile. Full per-post assertions arrive in Plan 04;
// this file must exist now so Plan 04 extends rather than retrofits.
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/'],
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
      },
    },
  },
};
