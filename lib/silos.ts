// Silo taxonomy — single source for D-05 display labels and D-08 intro copy.
// Every route, breadcrumb, landing, and sitemap MUST import slugs, labels,
// and intro prose from here — never re-derive or duplicate these strings
// (Phase 1 single-source rule extended). Slugs stay machine-style (D-05);
// human labels are defined once in SILOS and reused in UI/breadcrumbs/headers.
// Landing URL shape (D-02): root `/${slug}` — see siloUrl().

export const SILO_SLUGS = [
  'ai-writing',
  'ai-coding',
  'ai-image',
  'ai-productivity',
  'ai-guides',
  'ai-news',
] as const;

export type SiloSlug = (typeof SILO_SLUGS)[number];

export interface Silo {
  slug: SiloSlug;
  /** Human display label, reused in UI, breadcrumbs, and landing headers. */
  label: string;
  /** Landing page <title> / H1 source. */
  landingTitle: string;
  /** Landing meta description (150–160 chars, same discipline as posts). */
  metaDescription: string;
  /** Unique 120–160-word landing intro prose (thin-content-safe). */
  intro: string;
}

export const SILOS: Record<SiloSlug, Silo> = {
  'ai-writing': {
    slug: 'ai-writing',
    label: 'AI Writing',
    landingTitle: 'AI Writing Tools: Comparisons, Guides & Best Picks',
    metaDescription:
      'Compare the best AI writing assistants of 2026 — tested for quality, editing control, pricing, and originality. Find the right tool for your workflow.',
    intro:
      'AI writing assistants have moved past novelty into daily workflow: drafting posts, rewriting rough notes, tightening marketing copy, checking grammar, and paraphrasing research without losing meaning. This hub collects our hands-on comparisons of the tools bloggers, marketers, and founders actually open every morning — Jasper and Copy.ai for structured marketing output, ChatGPT and Claude for flexible long-form drafting, Grammarly for line-level polish, Quillbot for paraphrasing, and Rytr for budget-conscious teams. Every guide below names real pricing tiers, shows where each tool breaks down, and explains the editing pass required before anything ships. We retest flagship picks when major model upgrades land, so recommendations track current capability rather than launch hype. Start with the comparison roundup, then go deeper on whichever workflow matches yours.',
  },
  'ai-coding': {
    slug: 'ai-coding',
    label: 'AI Coding',
    landingTitle: 'AI Coding Assistants: ChatGPT vs Claude, Copilot & More',
    metaDescription:
      'ChatGPT vs Claude for coding in 2026, Copilot workflows, and honest AI code assistant reviews — tested on real tasks so you can ship faster with fewer bugs.',
    intro:
      'AI coding assistants now write boilerplate, explain cryptic errors, scaffold entire features, and review pull requests in seconds — but picking the wrong one costs you debugging hours instead of saving them. This hub gathers our head-to-head tests of the assistants developers actually rely on: ChatGPT and Claude for reasoning through hard problems, GitHub Copilot for in-editor autocomplete speed, and a rotating cast of specialized agents for testing, refactoring, and documentation. Each guide runs the same realistic tasks through every contender, scores correctness over cleverness, and flags where human review stays mandatory. Model capabilities shift every few months, so we revisit verdicts after significant releases. Begin with the flagship ChatGPT-versus-Claude coding showdown, then explore the workflow guides that fit your stack.',
  },
  'ai-image': {
    slug: 'ai-image',
    label: 'AI Image Generation',
    landingTitle: 'Best Free AI Image Generators in 2026 (Tested & Ranked)',
    metaDescription:
      'The best free AI image generators of 2026, tested side by side for quality, limits, and commercial use — plus prompting guides that get better results.',
    intro:
      'Free AI image generators range from genuinely impressive to barely usable, and the difference decides whether your blog headers, thumbnails, and social cards look professional or forgettable. This hub rounds up the generators worth your time in 2026 — Midjourney for top-end quality, DALL-E and Firefly for safe commercial use, Stable Diffusion for unlimited local generation, and the best truly-free browser options for quick-turnaround graphics. Our comparisons generate the same prompts across every tool, publish the unedited outputs, and spell out resolution caps, daily limits, and licensing fine print. We also cover the prompting fundamentals that lift results on any platform: composition, style words, and negative prompts. Start with the ranked roundup, then sharpen your technique with the prompting guides.',
  },
  'ai-productivity': {
    slug: 'ai-productivity',
    label: 'AI Productivity',
    landingTitle: 'AI Productivity Tools: Roundups, Workflows & Best Picks',
    metaDescription:
      'The AI productivity tools worth paying for in 2026 — meeting notes, inbox triage, scheduling, and focus workflows, tested for real time saved each week.',
    intro:
      'The average knowledge worker loses hours weekly to meetings, inbox triage, scattered notes, and status updates — exactly the repetitive work AI handles well when the setup is right. This hub collects our roundups of the productivity tools that earn back more time than they cost to configure: meeting assistants that produce usable summaries, inbox tools that draft replies in your voice, note apps with genuinely useful recall, and scheduling aides that end calendar ping-pong. Every review measures setup effort against weekly time saved, states plainly who each tool suits, and notes privacy trade-offs before you connect your accounts. Vendors ship features fast, so we refresh picks as standout capabilities emerge. Start with the overall roundup, then drill into the workflow guides for your biggest time sink.',
  },
  'ai-guides': {
    slug: 'ai-guides',
    label: 'AI Guides',
    landingTitle: 'AI Guides: Better Prompts, Smarter Workflows & Know-How',
    metaDescription:
      'Practical AI guides for 2026 — write better prompts, avoid rookie mistakes, verify AI output, and build prompting skills that transfer across every tool.',
    intro:
      'The gap between mediocre and excellent AI output is rarely the model — it is the skill of the person driving it. This hub hosts our evergreen how-to guides: writing prompts that get precise answers on the first try, structuring multi-step tasks the model can actually follow, verifying AI output instead of trusting it blindly, and avoiding the rookie mistakes that waste credits and credibility. Unlike tool reviews that expire with each release cycle, these guides teach transferable technique that works across ChatGPT, Claude, Gemini, and whatever launches next. Each article pairs concrete before-and-after examples with checklists you can reuse immediately. New to prompting? Start with the flagship better-prompts walkthrough, then work through the verification and workflow guides — and bookmark the checklists, since they compound in value as models improve.',
  },
  'ai-news': {
    slug: 'ai-news',
    label: 'AI & Tech News',
    landingTitle: 'Breaking AI & Tech News: Daily Analysis & Industry Updates',
    metaDescription:
      'Get daily breaking AI and tech news analyzed for developers, engineers, and tech creators. Real architectural insights, zero fluff, updated every morning.',
    intro:
      "The artificial intelligence and software engineering ecosystem moves too quickly for shallow recaps and marketing press releases. Our daily news desk tracks foundation model releases, developer tooling shifts, open-source breakthroughs, and infrastructure benchmarks that genuinely impact production workflows. Every morning, our automated intelligence engine ingests reports across engineering communities, filters out speculative hype, and delivers deep architectural analysis: what actually launched, how it works under the hood, benchmark verifications, and what it means for practitioners building software today. Rather than repeating rumors, every report links to primary sources, documentation, and code repositories. Start with today's breaking coverage below, or explore our categorized guides to see how emerging models compare to existing industry standards.",
  },
};

/** Look up a silo definition by slug; undefined for undeclared slugs. */
export function getSilo(slug: string): Silo | undefined {
  return (SILOS as Record<string, Silo>)[slug];
}

/** Root landing URL for a silo (D-02 root shape: `/{silo}`). */
export function siloUrl(slug: SiloSlug): string {
  return `/${slug}`;
}
