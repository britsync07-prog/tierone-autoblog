# TierOne AutoBlog

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black.svg?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

TierOne AutoBlog is a fully automated blogging platform built to capture high-volume organic search traffic exclusively from Tier-1 countries (US, UK, CA, AU).

It autonomously researches, drafts, optimizes, and publishes long-form SEO-structured articles daily with zero human intervention.

## What This Is

This project is a complete end-to-end programmatic SEO platform. It acts as an autonomous AI agent capable of managing the entire lifecycle of a content site:
- **Keyword Research & Strategy:** Finds long-tail, low-competition keywords (KD < 20) with strong search volume.
- **Content Creation:** Generates comprehensive outlines and drafts 1,500–2,500 word articles.
- **On-Page SEO Optimization:** Strictly structures content with optimized H1s, meta descriptions, FAQ schema, and programmatic breadcrumbs.
- **Automated Publishing:** Schedules and releases high-quality, formatted posts daily without manual gating.

## Why It Was Built

The primary objective was to build a system that maximizes Tier-1 visitor volume through long-tail organic search traffic in the Tech/AI & Digital Tools niche. I wanted to prove that a completely automated, hands-off pipeline could build topical authority over time without relying on paid APIs or expensive content tools, relying instead on high-quality, procedurally generated programmatic SEO architecture.

It's designed to win search rankings by consistently publishing high-quality, helpful content that passes strict quality gates.

## Core Value

By structuring the content intelligently and adhering strictly to Core Web Vitals (LCP < 2.5s, INP < 200ms, CLS < 0.1), the platform ensures Tier-1 readers land on Google Page 1, stay engaged, and grow organic sessions continuously.

## Challenges Faced & How I Solved Them

Building a fully autonomous AI agent to write articles without producing low-quality "spam" content was the biggest hurdle. Here is how I tackled the core problems:

### 1. Preventing Thin or Spammy AI Content
**The Problem:** AI-generated content can often be repetitive, shallow, or hallucinate facts, risking a manual Google spam penalty.
**The Solution:** I built an extensive set of **Quality Gates**. The pipeline includes an originality and anti-near-duplicate shingler, fact-checking verification, and an Information Gain evaluator. If content fails the thin-content floor, uses banned AI phrases ("delve", "fast-paced world"), or generates unverified factual claims, the post is automatically quarantined instead of published.

### 2. Ensuring Bulletproof SEO Architecture
**The Problem:** Generating articles isn't enough; search engines need to understand the site's structure to crawl efficiently and assign topical authority.
**The Solution:** I implemented a strict silo taxonomy with programmatic SEO architecture. Every post emits valid `Article`, `FAQPage`, and `BreadcrumbList` JSON-LD schema. Internal links are automated to enforce topic clusters, and split XML sitemaps ensure optimal crawl budget usage.

### 3. Avoiding Paid Third-Party Tools
**The Problem:** Most automated SEO pipelines rely on expensive third-party tools for keyword research and SERP analysis (like Ahrefs or DataForSEO).
**The Solution:** As an individual developer, I pivoted the architecture to rely entirely on free, keyless in-house solutions or free-tier endpoints. The system generates its own long-tail programmatic clusters and deduplicates topics to prevent keyword cannibalization autonomously.

### 4. Continuous, Safe Autonomous Publishing
**The Problem:** Scheduling daily cron jobs could lead to broken links, failed deployments, or poor user experience if an unverified page goes live.
**The Solution:** I integrated a live-URL verifier post-publish. Once an article is published, a job checks the real URL for status codes, schema validity, and broken links. If anything fails, it automatically unpublishes the post and alerts me.

## Tech Stack

- **Framework:** Next.js 16.x (App Router)
- **Content:** MDX (Content Collections + Zod)
- **Language:** TypeScript (Strict)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel / Cloudflare CDN Edge

## Getting Started

### Prerequisites

Ensure you have Node.js version 22 or higher installed.

### Installation

1. Clone the repository:
   ```shell
   git clone https://github.com/your-username/tierone-autoblog.git
   cd tierone-autoblog
   ```

2. Install dependencies:
   ```shell
   npm install
   ```

3. Set up environment variables:
   Copy `.env.example` to `.env` and fill in any required keys.
   ```shell
   cp .env.example .env
   ```

4. Run the development server:
   ```shell
   npm run dev &
   ```

5. Build the project:
   ```shell
   npm run build
   ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. Since this is built to be a standalone autonomous agent, enhancements to the AI evaluation stages, quality gates, or SEO schemas are highly appreciated.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Created by Musfiqur Rahman Saimon*
