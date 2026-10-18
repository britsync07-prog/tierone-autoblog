# Phase 4: Quality Gates - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-18
**Phase:** 04-quality-gates
**Areas discussed:** Quarantine Storage & Isolation, Fact-Checking & Claim Verification, Information Gain & Originality Scoring, Auto-Pause Thresholds & Failure Alerting

---

## Quarantine Storage & Isolation

### Question 1: Physical location of quarantined drafts
| Option | Description | Selected |
|--------|-------------|----------|
| Physical Isolation | Move failed MDX drafts out of content/posts/ into content/quarantine/{id}.mdx with a companion {id}-report.json audit file | ✓ |
| Registry-Only Storage | Delete failed MDX from disk completely and preserve full draft payload in content/quarantine/{id}.json | |
| Frontmatter Draft Flag | Leave MDX in content/posts/ but set draft: true in frontmatter | |

**User's choice:** Physical Isolation — Move failed MDX drafts out of `content/posts/` into `content/quarantine/{id}.mdx` with companion `{id}-report.json`.

### Question 2: Registry state representation
| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated stage: 'quarantined' | Add 'quarantined' to RegistryStage enum with quarantine metadata, permanently parking until manual reset | ✓ |
| Reuse stage: 'rejected' | Mark keyword as 'rejected' with rejectionReason: 'quarantine: <rule>' | |
| Keep stage: 'drafted' | Keep stage as 'drafted' with qa.status: 'quarantined' | |

**User's choice:** Dedicated stage: `'quarantined'` in `RegistryStage` enum.

### Question 3: Quarantine queue presentation & management
| Option | Description | Selected |
|--------|-------------|----------|
| CLI inspection commands | npm run quarantine:list and npm run quarantine:view <id>, plus an auto-updated content/quarantine/SUMMARY.md index | ✓ |
| Single aggregated JSON file | Central content/quarantine/index.json ledger | |
| Standalone static HTML report | Local static HTML report at content/quarantine/index.html | |

**User's choice:** CLI inspection commands (`npm run quarantine:list` and `npm run quarantine:view <id>`) + `SUMMARY.md` index.

---

## Fact-Checking & Claim Verification

### Question 1: Unverifiable claims vs planted false statistics
| Option | Description | Selected |
|--------|-------------|----------|
| Two-Tier Handling | Minor unverifiable fluff/unsourced generalities excised; fabricated/planted false stats trigger immediate quarantine | ✓ |
| Strict Zero-Tolerance Quarantine | Any unverified statistic or claim immediately quarantines the entire post | |
| Auto-Prune and Re-Validate | Always excise unverifiable claims; only quarantine if word count drops below floor | |

**User's choice:** Two-Tier Handling — auto-excise minor unsourced fluff, quarantine fabricated/planted false stats.

### Question 2: Verification mechanism under fully-free constraint
| Option | Description | Selected |
|--------|-------------|----------|
| Extraction + Cached Ground Truth & Keyless Search | Extract claims via LLM; cross-check numbers/dates against cached SERP/brief data; keyless search for unmatched stats; mandate source-naming in text | ✓ |
| Cached Data & Source-Citation Mandatory | Only verify against cached SERP data; mandate named source in text | |
| Pure Heuristic Regex & Date Check | Regex scan for numbers/dates without semantic cross-check | |

**User's choice:** Extraction + Cached Ground Truth & Keyless Search + mandatory source citations.

### Question 3: Topic blocklist & real-publisher byline enforcement
| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic Fast-Fail Pre-Filter | Fast regex/keyword scanner for blocked YMYL topics + schema validation for author byline and /editorial-process link | ✓ |
| Dual-Layer Heuristic + LLM Classifier | Regex filter followed by LLM classification prompt | |
| Registry/Keyword-Level Only | Only block topics during keyword research | |

**User's choice:** Deterministic Fast-Fail Pre-Filter.

---

## Information Gain & Originality Scoring

### Question 1: Originality & near-duplicate detection
| Option | Description | Selected |
|--------|-------------|----------|
| Algorithmic N-Gram/Jaccard Similarity Floor | Deterministic n-gram (shingling/Jaccard) similarity against corpus posts & cached SERP (threshold > 0.70 = quarantine) | ✓ |
| LLM-Based Originality Evaluator | Dedicated LLM prompt rating originality 1-10 | |
| Hybrid Shingle + LLM | Shingles for verbatim copies + LLM for conceptual overlap | |

**User's choice:** Algorithmic N-Gram/Jaccard Similarity Floor (similarity > 0.70 = quarantine).

### Question 2: Information Gain vs Top-3 SERP evaluation
| Option | Description | Selected |
|--------|-------------|----------|
| Structured 4-Point Information Gain Rubric | LLM evaluation checking (1) unique workflow guidance, (2) structured comparison synthesis, (3) edge-case coverage, (4) gap closure (must score >= 3/4) | ✓ |
| Deterministic Gap Check | Verify competitor gaps from brief are addressed in headings | |
| Combined Gap Check + LLM Depth Score | Gap headings verified programmatically + LLM depth check | |

**User's choice:** Structured 4-Point Information Gain Rubric ($\ge 3/4$ required to pass).

### Question 3: Link-validity gate
| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic Link Crawl Gate | Internal links must exist in Next.js route table (broken = quarantine); external links probed with HTTP HEAD (timeout 4s; strip broken external link anchor or quarantine) | ✓ |
| Strict Fail-Closed on Any Broken Link | Both internal and external link failures trigger instant quarantine | |
| Internal Routes Only | Only validate internal links | |

**User's choice:** Deterministic Link Crawl Gate.

---

## Auto-Pause Thresholds & Failure Alerting

### Question 1: Consecutive failure threshold K
| Option | Description | Selected |
|--------|-------------|----------|
| K = 3 Consecutive Failures | Sensitive circuit-breaker: 3 consecutive draft quarantines halts pipeline publishing | ✓ |
| K = 5 Consecutive Failures | More relaxed threshold | |
| Configurable via env (Default K = 3) | Optional env threshold | |

**User's choice:** $K = 3$ Consecutive Failures.

### Question 2: Auto-pause state persistence & resume mechanism
| Option | Description | Selected |
|--------|-------------|----------|
| Persistent State Lockfile + CLI Resume | Store paused: true in content/keywords/pipeline-state.json; abort pipeline preflight; resume via npm run pipeline:resume | ✓ |
| Environment Variable Lock | Check QA_PIPELINE_PAUSED=1 | |
| Manual Registry Edit | Manually edit registry file to clear flag | |

**User's choice:** Persistent State Lockfile (`pipeline-state.json`) + CLI Resume (`npm run pipeline:resume`).

### Question 3: Owner alert dispatch channels
| Option | Description | Selected |
|--------|-------------|----------|
| Multi-Channel: Terminal Banner + content/quarantine/ALERT.md + Optional Webhook | Stderr alert banner + actionable content/quarantine/ALERT.md + optional ALERT_WEBHOOK_URL POST payload | ✓ |
| Local File & Terminal Only | Local file and terminal only | |
| Email / SMTP Notification | SMTP email notification | |

**User's choice:** Multi-Channel: Terminal Banner + `content/quarantine/ALERT.md` + Optional Webhook.
