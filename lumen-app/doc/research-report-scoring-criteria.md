# Research Report Scoring Criteria

Status: ACTIVE
Owner: Lumen research workflow
Last Updated: 2026-05-04
Current Version: v0.5

This document records the scoring standard for Lumen research judgment reports. Update it whenever a new review exposes a better criterion, a changed weight, or a recurring failure mode.

## Scope

This rubric applies to reports that synthesize multiple papers for product or research judgment. It is especially relevant when the expected output is not a paper-by-paper summary, but a cross-paper diagnosis, prioritization, and recommendation for Lumen.

## Source Basis

The standard is adapted from public guidance on literature reviews and evidence synthesis:

- SWiM reporting guideline: strong narrative synthesis should make study grouping, synthesis method, data presentation, certainty, and limitations transparent. It also warns that weak narrative synthesis often has unclear links between evidence and conclusions. Source: https://www.bmj.com/content/368/bmj.l6890
- PRISMA 2020 reporting checklist: strong review reporting should state objectives, eligibility criteria, information sources, risk or limitation handling, synthesis method, included-study characteristics, interpretation, and evidence limitations. Source: https://link.springer.com/article/10.1186/s13643-021-01626-4/tables/3
- Georgetown University Library: a literature review should be organized around ideas or concepts rather than individual sources. Source: https://guides.library.georgetown.edu/c.php?g=76030&p=8469679
- University of Wyoming Writing Center: a literature review should start from the research question, synthesize relationships among works, assess assumptions and findings, address conflicts, and identify gaps. Source: https://www.uwyo.edu/writing-center/_files/handouts/7-literature-reviews-uwwc.pdf
- SANRA: narrative review quality should assess importance, aims, literature search description, referencing, scientific reasoning, and appropriate endpoint data. Source: https://researchintegrityjournal.biomedcentral.com/articles/10.1186/s41073-019-0064-8
- AMSTAR 2: review appraisal should not rely on one overall score alone; critical domains such as search adequacy, exclusions, risk of bias, synthesis methods, and interpretation can determine whether a review is trustworthy. Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC5833365/
- ROBIS: review quality should include bias checks around eligibility, study identification, data collection/appraisal, synthesis, and interpretation. Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC4687950/

## Rubric v0.2

Total: 100 points.

| Dimension | Weight | Excellent Standard |
| --- | ---: | --- |
| Research purpose clarity | 10 | The report states the actual decision question, target audience, and output contract. It does not drift into generic summary. |
| Paper-level depth and mechanism concreteness | 20 | Each paper receives a substantive explanation of the problem, mechanism, evidence, limitation, and why it matters. Named methods must be unpacked in plain terms; jargon without explanation should score poorly. |
| Evidence mapping and grouping transparency | 15 | Each paper is mapped to a clear category with explicit evidence: research object, mechanism, metric or finding, and reason for the grouping. |
| Synthesis over stacked summary | 15 | The report compares papers across themes, exposes relationships, tensions, gaps, and field direction. It does not merely summarize one paper after another. |
| Lumen borrowing and product decision value | 20 | The report ranks what Lumen should borrow, explains why, names implementation paths, and separates short-term product value from long-term research bets. |
| Limits, uncertainty, and risk boundary | 10 | The report distinguishes strong evidence from analogy, states applicability limits, risk boundaries, missing data, and confidence rationale. |
| Structure and readability | 10 | The report is easy to scan, has stable sectioning, uses tables where they reduce ambiguity, and keeps claims tied to the user question. |

## Depth Requirements

For a four-paper deep report, Excellent requires:

- Each paper must have its own deep-reading section, not only one row in a table.
- Each paper section must explain at least five things: the real problem, the proposed mechanism, the concrete evidence or experiment, what the paper does not solve, and what Lumen can or cannot borrow.
- Method names such as SpecEyes, ReVal, GSEM, agentic depth, answer separability, replay buffer, dual-layer graph, or pitch manipulation must be explained. Using the names without explanation counts as shallow.
- The report must include cross-paper synthesis after the paper sections. It should explain what the four papers collectively reveal, where they conflict, and what priority order follows for Lumen.
- For four papers, a CLI report should generally be long enough to support the above depth. A short report can only score Excellent if it still contains concrete mechanisms and evidence for every paper.

## Score Bands

| Score | Label | Meaning |
| ---: | --- | --- |
| 90-100 | Excellent | Strong enough for a high-quality research assistant output; evidence, synthesis, and decision logic are all explicit. |
| 80-89 | Good | Useful and mostly defensible, but still missing some evidence detail, limitation handling, or synthesis depth. |
| 70-79 | Usable | Can pass a basic evaluation case, but not strong enough as an excellent research report. |
| 60-69 | Weak | Contains relevant content, but core judgment, synthesis, or evidence grounding is incomplete. |
| < 60 | Failing | Mostly summary, unclear decision value, or insufficient evidence connection. |

## Evidence Matrix Template

Use this matrix when a report needs to justify cross-paper grouping.

| Paper | Research object | Core mechanism | Key metric or finding | Mapped bottleneck | Why this grouping | Lumen transferability |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

## Update Protocol

1. When scoring a new report, apply the current rubric first.
2. If the report reveals a missing dimension or an unfair weight, update the rubric version and record the rationale.
3. Keep prior score records intact. Do not silently rewrite old scores under a new rubric.
4. Append each scoring run to the score records section with date, reviewer, score, and main deductions.
5. If the report domain changes materially, search for domain-specific evaluation standards and add sources before changing weights.
6. A scoring reviewer or subagent must read this document before scoring. If the rubric was provided verbally before the document existed, record that explicitly as a process limitation.

## Rubric Evolution Protocol

Do not rely only on owner feedback to discover rubric gaps. Use this loop when a report is scored or when a new report type appears:

1. **External-standard pass**: Check whether the task resembles a narrative review, systematic review, evidence synthesis, product research memo, or technical design review. Add relevant external standards before changing weights.
2. **Failure-mode pass**: Ask what kind of bad report could still score highly under the current rubric. Add a negative anchor for that failure mode. Example: "jargon without explanation" scored too high under v0.1.
3. **Golden-output pass**: Maintain at least one strong example and one weak example for each recurring report type. Score both and verify the strong example clearly outranks the weak one.
4. **Adversarial-review pass**: A review subagent must answer: "Why might this score be too generous?" before finalizing any Excellent score.
5. **Critical-domain pass**: Inspired by AMSTAR 2, a single critical failure can cap the score even if other dimensions are strong. For Lumen research reports, unexplained mechanisms, unsupported claims, or missing Lumen decision value should cap the report below Excellent.
6. **Regression-test pass**: Convert recurring quality failures into deterministic tests where possible, such as requiring per-paper deep-reading sections, concrete mechanisms, evidence links, and explicit Lumen actions.
7. **Versioned-change pass**: Every new dimension or weight change bumps the rubric version and preserves old scores as historical, not comparable, records.

### Critical Failure Caps

These caps apply even when the total arithmetic score looks high:

| Failure | Maximum Band |
| --- | --- |
| Uses method names without explaining mechanisms | Good |
| Lacks per-paper deep-reading sections for a multi-paper report | Good |
| Contains synthesis claims not tied to evidence | Usable |
| Gives Lumen recommendations without implementation path or tradeoff | Good |
| Has no limitations or uncertainty section | Usable |
| Cannot tell the reader what decision the report supports | Usable |
| Report content is hardcoded to known evaluation papers, URLs, or fixture-specific mechanisms instead of derived from supplied evidence | Failing |
| Claims to be a deep paper report while accessible paper links are available but no temporary PDF download/full-text extraction is attempted | Weak |

## Score Records

### 2026-05-04 - PDF evidence pipeline final review

Reviewer: subagent Heisenberg
Rubric: v0.5, read from this document before scoring
Score: 91/100
Band: Excellent

Critical failure caps:

| Cap | Triggered |
| --- | --- |
| Claims to be a deep paper report while accessible paper links are available but no temporary PDF download/full-text extraction is attempted | No |

Main findings:

- CLI and GUI/agent runtime now both attempt PDF evidence before producing a research judgment report.
- CLI downloads PDFs to a local temporary directory, extracts PDF text, and reports the PDF URL plus temporary path.
- GUI/agent runtime now routes research judgment links through `previewSearchResultPaper`, which uses the existing temporary PDF preview/cache pipeline rather than synchronously returning an abstract-only report.
- Tauri `fetch_open_pdf` returns the local cache path so evidence source can be traced back to a temporary PDF file.

Remaining risks:

- Runtime integration still needs a dedicated regression test around `runResearchHarness -> research_judgment_pdf_preview -> previewSearchResultPaper -> report`.
- PDF text preview is still truncated/preview-based, not full systematic-review-grade section-aware reading.
- Cache hits may return `pdf_text_preview` without structured `pdfResolution`, so evidence source rows can lose the temporary path even though cached preview text exists.
- `download_failed` currently merges “no PDF found” and “download/extraction failed”; future diagnostics should distinguish those states.

### 2026-05-04 - PDF evidence pipeline correction

Reviewer: owner feedback
Rubric: v0.5
Score: invalidated as a deep-report system before correction
Band: Weak for depth validity

Finding:

- A report generator that only uses titles and abstracts can be useful for smoke tests, but it is not a deep paper-analysis system.
- When accessible links such as arXiv URLs are supplied, the system must attempt to normalize them to PDF URLs, download the PDF to a local temporary directory, extract text evidence, and record the evidence source in the report.
- Silent fallback from failed PDF download to abstract-only evidence is unacceptable for a deep report because it hides evidence weakness from the reader.

Required correction:

- The CLI and agent evidence path must distinguish `pdf_text`, `abstract`, `metadata`, and `download_failed`.
- Temporary PDF paths and PDF URLs must be visible in the report when PDF evidence is used.
- Download failures must be visible as evidence-source failures, not silently disguised as normal abstract evidence.
- Regression tests should verify URL-to-PDF normalization, local temporary PDF path usage, full-text extraction handoff, and report evidence-source disclosure.

### 2026-05-04 - Research judgment generator anti-hardcoding final review

Reviewer: subagent Heisenberg
Rubric: v0.4, read from this document before scoring
Score: 93/100
Band: Excellent

Critical failure caps:

| Cap | Triggered |
| --- | --- |
| Report content is hardcoded to known evaluation papers, URLs, or fixture-specific mechanisms instead of derived from supplied evidence | No |

Main findings:

- Production code no longer contains the four evaluation paper titles, arXiv URLs, benchmarks, answer-key mechanisms, or fixture-specific deep-reading content.
- Report content is derived from supplied `title`, `url`, and `abstractText`, plus domain-general bottleneck profiles.
- Synthetic anti-leak tests now cover inference, training, memory, and social-risk directions, and assert that evaluation-paper names, benchmarks, and mechanisms do not leak into synthetic reports.

Remaining risks:

- The system is still a deterministic research-judgment heuristic, not full PDF-level literature understanding.
- Ranking still uses product-strategy priors by bottleneck category, so it is not purely evidence-weighted.
- Future adversarial tests should cover misleading titles, title/abstract conflict, URL-only inputs, and papers spanning multiple bottlenecks.

### 2026-05-04 - Research judgment generator anti-hardcoding first review

Reviewer: subagent Heisenberg
Rubric: v0.4, read from this document before scoring
Score: 88/100
Band: Good

Critical failure caps:

| Cap | Triggered |
| --- | --- |
| Report content is hardcoded to known evaluation papers, URLs, or fixture-specific mechanisms instead of derived from supplied evidence | No |

Main deductions:

- Production code no longer hardcoded the four paper titles, URLs, benchmark names, or answer paragraphs.
- However, some bottleneck-profile keywords remained too close to the evaluation fixture, such as `bellman`, `q-values`, `pitch`, `paralinguistic`, and `funnel`.
- Anti-leak testing covered a synthetic inference paper, but did not yet cover synthetic training, memory, and social-risk papers.

Outcome:

- Superseded by the final v0.4 review after removing fixture-adjacent profile keywords and adding cross-bottleneck synthetic anti-leak tests.

### 2026-05-04 - System evaluation integrity correction

Reviewer: owner feedback
Rubric: v0.4
Score: invalidated as a system-quality evaluation
Band: Failing for implementation validity

Finding:

- The generated report could be deep for the four evaluation papers while still relying on production-code knowledge of those exact papers.
- That makes the report artifact partially correct but the system behavior invalid: a research judgment system must derive paper mechanisms from supplied titles, abstracts, URLs, or retrieved content, not from fixture-specific answer keys.
- v0.4 adds an anti-hardcoding critical cap. A report generator that leaks known evaluation answers cannot score above Failing for system-quality evaluation, regardless of how polished the specific output looks.

Required correction:

- Production code may keep only domain-general bottleneck profiles and ranking heuristics.
- Paper-specific names, mechanisms, benchmarks, and links belong in test fixtures, retrieved evidence, or user input.
- Regression tests must include at least one unseen synthetic paper and assert that known evaluation-paper explanations do not leak into its report.

### 2026-05-04 - AI Agent System Bottleneck Report, deep-reading revision

Reviewer: subagent Heisenberg
Rubric: v0.3, read from this document before scoring
Score: 91/100
Band: Excellent

Breakdown:

| Dimension | Score |
| --- | ---: |
| Research purpose clarity | 10/10 |
| Paper-level depth and mechanism concreteness | 18/20 |
| Evidence mapping and grouping transparency | 15/15 |
| Synthesis over stacked summary | 14/15 |
| Lumen borrowing and product decision value | 19/20 |
| Limits, uncertainty, and risk boundary | 8/10 |
| Structure and readability | 7/10 |

Critical failure caps:

| Cap | Triggered |
| --- | --- |
| Uses method names without explaining mechanisms | No |
| Lacks per-paper deep-reading sections for a multi-paper report | No |
| Contains synthesis claims not tied to evidence | No |
| Gives Lumen recommendations without implementation path or tradeoff | No |
| Has no limitations or uncertainty section | No |
| Cannot tell the reader what decision the report supports | No |

Main deductions:

- The report now has concrete per-paper mechanisms, but some confidence scoring remains heuristic rather than evidence-quality based.
- Cross-paper synthesis is stronger than prior versions, but could still discuss alternative interpretations more deeply.
- CLI readability is acceptable for a report, but dense for command-line output.

Reliability note:

- This 91/100 score is more trustworthy than the earlier v0.1 93/100 because v0.3 explicitly checks paper-level depth, jargon explanation, and critical failure caps.
- The prior v0.1 Excellent score should be treated as a structural-rubric artifact, not a final quality judgment.

### 2026-05-04 - Rubric correction after shallow Excellent score

Reviewer: owner feedback
Rubric: v0.1
Score: invalidated as insufficiently strict
Band: superseded by v0.2

Finding:

- The previous v0.1 standard over-rewarded structure, evidence tables, and explicit boundaries while under-weighting concrete paper understanding.
- A report could reach 93/100 while still feeling shallow because it named methods such as GSEM and SpecEyes without explaining their internal mechanics in enough detail.
- v0.2 adds a 20-point "Paper-level depth and mechanism concreteness" dimension and reduces weights for dimensions that were already covered structurally.

Required correction:

- Re-score the report under v0.2 after generating a genuinely deeper four-paper report.
- Do not treat the previous 93/100 as evidence that the report meets the user's depth requirement.

### 2026-05-04 - AI Agent System Bottleneck Report, contract-confidence-gap revision

Reviewer: subagent Heisenberg
Rubric: v0.1, read from this document before scoring
Score: 93/100
Band: Excellent

Breakdown:

| Dimension | Score |
| --- | ---: |
| Research purpose clarity | 15/15 |
| Evidence mapping and grouping transparency | 20/20 |
| Synthesis over stacked summary | 18/20 |
| Lumen borrowing and product decision value | 19/20 |
| Limits, uncertainty, and risk boundary | 13/15 |
| Structure and readability | 8/10 |

Main deductions:

- The confidence method is now explained, but remains heuristic rather than statistical.
- The synthesis section now covers cross-paper tensions and gaps, but could still go deeper on conflicts and alternative explanations.
- The CLI output is complete but dense; readability could improve if future UI rendering supports collapsible sections.

Change from prior score:

- The score improved from 88 to 93 after adding an explicit report contract, confidence rationale, and cross-paper tension/gap analysis.
- The report now reaches the Excellent band under rubric v0.1.

### 2026-05-04 - AI Agent System Bottleneck Report, evidence-matrix revision

Reviewer: subagent Heisenberg
Rubric: v0.1, read from this document before scoring
Score: 88/100
Band: Good

Breakdown:

| Dimension | Score |
| --- | ---: |
| Research purpose clarity | 13/15 |
| Evidence mapping and grouping transparency | 19/20 |
| Synthesis over stacked summary | 17/20 |
| Lumen borrowing and product decision value | 19/20 |
| Limits, uncertainty, and risk boundary | 12/15 |
| Structure and readability | 8/10 |

Main deductions:

- Confidence percentages are still under-explained. The report shows values such as 94% and 86%, but does not expose the scoring method behind them.
- The synthesis is good but not yet excellent. It identifies a shared agent-system direction, but could better discuss tensions, conflicts, and gaps across the four papers.
- The report contract is implicit. It performs topic judgment for Lumen, but does not explicitly state audience, decision supported, and output contract at the opening.

Change from prior score:

- The score improved from 76 to 88 after adding an evidence mapping matrix, a synthesis judgment section, and a limits/risk-boundary section.
- The report is now a good current-case acceptance output. Reaching Excellent requires clearer confidence rationale and deeper cross-paper argumentation.

### 2026-05-04 - AI Agent System Bottleneck Report

Reviewer: subagent Heisenberg
Rubric: v0.1, provided verbally before this document was created
Score: 76/100
Band: Usable

Breakdown:

| Dimension | Score |
| --- | ---: |
| Research purpose clarity | 13/15 |
| Evidence mapping and grouping transparency | 15/20 |
| Synthesis over stacked summary | 14/20 |
| Lumen borrowing and product decision value | 17/20 |
| Limits, uncertainty, and risk boundary | 8/15 |
| Structure and readability | 9/10 |

Main deductions:

- Evidence granularity is not strong enough. The grouping rationale lacks paper-level mechanisms, experiment objects, metrics, and findings.
- The synthesis argument is still thin. It identifies four bottlenecks, but does not fully explain what the set of papers collectively says about recent AI Agent system direction.
- Limits and uncertainty are underdeveloped. Confidence scores need rationale, and the report should separate arXiv-paper uncertainty, cross-domain transfer risk, and Lumen architecture constraints.

Priority improvements:

- Add the evidence matrix before the final ranking.
- Add one synthesis thesis that states the field-level conclusion and Lumen priority order.
- Add a limitation section distinguishing strong evidence, analogy-based inference, short-term product action, and long-term research bets.

## Rubric Change Log

### v0.5 - 2026-05-04

Added a PDF evidence pipeline cap. A deep report with accessible paper links cannot score highly if it only uses titles and abstracts or silently falls back after failed downloads. The report must disclose whether evidence came from temporary PDF text, abstract, metadata, or failed PDF retrieval.

### v0.4 - 2026-05-04

Added a system-evaluation integrity cap for hardcoded answers and fixture leakage. This separates report artifact quality from generator validity: even a detailed report is not acceptable if the production code contains paper-specific answer keys for the evaluation case.

### v0.3 - 2026-05-04

Added the rubric evolution protocol, critical failure caps, and additional methodological sources: SANRA, AMSTAR 2, and ROBIS. This version clarifies that future rubric gaps should be found proactively through external standards, adversarial review, golden examples, and regression tests, not only through owner feedback.

### v0.2 - 2026-05-04

Added a 20-point dimension for paper-level depth and mechanism concreteness. This corrects the v0.1 failure mode where a structurally complete but shallow report could score Excellent. The new standard explicitly penalizes unexplained jargon and requires substantive per-paper deep-reading sections.

### v0.1 - 2026-05-04

Initial rubric created from SWiM, PRISMA 2020, and university literature review guidance. Added the first scoring record for the Lumen AI Agent system bottleneck report.
