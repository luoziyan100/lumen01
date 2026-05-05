import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import test from 'node:test'
import { promisify } from 'node:util'

import {
  buildResearchJudgmentReport,
  tryBuildResearchJudgmentReportFromText,
  classifyPaperBottleneck,
  detectResearchJudgmentRequest,
  rankLumenBorrowingValue,
} from '../src/agent/research-judgment.ts'
import { enrichPapersWithDownloadedEvidence, pdfUrlForPaperUrl } from '../scripts/research-evidence.ts'

const execFileAsync = promisify(execFile)

const evaluationPapers = [
  {
    title: 'SpecEyes: Accelerating Agentic Multimodal LLMs via Speculative Perception and Planning',
    url: 'https://arxiv.org/abs/2603.23483v1',
    abstractText: 'Agentic multimodal large language models achieve reasoning capabilities through iterative visual tool invocation. Cascaded perception, reasoning, and tool-calling loops introduce significant sequential overhead, termed agentic depth, which incurs prohibitive latency and limits system-level concurrency. SpecEyes uses a lightweight tool-free MLLM as a speculative planner, cognitive gating based on answer separability, and a heterogeneous parallel funnel. Experiments on V* Bench, HR-Bench, and POPE show 1.1-3.35x speedup while preserving or improving accuracy up to 6.7%.',
  },
  {
    title: 'Off-Policy Value-Based Reinforcement Learning for Large Language Models',
    url: 'https://arxiv.org/abs/2603.23355v1',
    abstractText: 'Improving data utilization efficiency is critical for scaling reinforcement learning for long-horizon tasks where generating trajectories is expensive. Dominant RL methods for LLMs are largely on-policy: they update each batch once, discard it, and collect fresh samples. ReVal is a Bellman-update-based value-based method that combines stepwise internal consistency with trajectory-level outcome verification. It treats logits as Q-values to avoid a separate critic, uses reward shaping for Calibrated Initialization, and supports replay buffer based training to reuse past trajectories. On DeepSeek-R1-Distill-1.5B, ReVal improves AIME24 by 2.7% and GPQA by 4.5% over GRPO.',
  },
  {
    title: 'GSEM: Graph-based Self-Evolving Memory for Experience Augmented Clinical Reasoning',
    url: 'https://arxiv.org/abs/2603.22096v1',
    abstractText: 'Clinical decision-making agents can benefit from reusing prior decision experience. Many memory-augmented methods store experiences as independent records without explicit relational structure, causing noisy retrieval, unreliable reuse, Boundary Failure, Collaboration Failure, and sometimes worse performance than direct LLM inference. GSEM represents experience as condition, strategy, polarity, and quality Q_i, then organizes experiences into a dual-layer memory graph that captures decision structure within each experience and relational dependencies across experiences. Edge weight W_ij calibrates inter-experience relations. It supports applicability-aware retrieval and online feedback-driven calibration of node quality and edge weights. Across MedR-Bench and MedAgentsBench, GSEM reaches 70.90% and 69.24% average accuracy with two LLM backbones.',
  },
  {
    title: 'Greater accessibility can amplify discrimination in generative AI',
    url: 'https://arxiv.org/abs/2603.22260v1',
    abstractText: 'Voice interaction promises to expand accessibility, but unlike text, speech carries identity cues and paralinguistic cues that users cannot easily mask. Audio-enabled LLMs exhibit systematic gender discrimination, shifting responses toward gender-stereotyped adjectives and occupations solely on the basis of speaker voice and amplifying bias beyond text interaction. Survey evidence with n=1,000 shows infrequent chatbot users are most hesitant to undisclosed attribute inference. Pitch manipulation can systematically regulate gender-discriminatory outputs, revealing a tension between accessibility and fairness.',
  },
] as const

test('detects research judgment prompts instead of ordinary paper summaries', () => {
  const prompt = `主题：近期 AI Agent 系统的效率、经验沉淀与风险边界
测什么：研究助理的选题判断力。
不是要求逐篇总结，而是判断这四篇分别对应什么系统瓶颈：推理效率、训练效率、长期记忆、社会风险。`

  assert.equal(detectResearchJudgmentRequest(prompt), true)
  assert.equal(detectResearchJudgmentRequest('请逐篇总结这四篇论文'), false)
})

test('normalizes arxiv abstract links to downloadable PDF links', () => {
  assert.equal(
    pdfUrlForPaperUrl('https://arxiv.org/abs/2603.23483v1'),
    'https://arxiv.org/pdf/2603.23483v1',
  )
  assert.equal(
    pdfUrlForPaperUrl('https://arxiv.org/pdf/2603.23483v1.pdf'),
    'https://arxiv.org/pdf/2603.23483v1',
  )
})

test('enriches papers by downloading PDFs to temporary files and extracting full text', async () => {
  const downloads: Array<{ url: string; path: string }> = []
  const input = {
    topic: 'PDF evidence pipeline',
    papers: [{
      title: 'FullTextPipe: Full Paper Evidence for Research Agents',
      url: 'https://arxiv.org/abs/1234.56789',
      abstractText: 'This abstract is intentionally thin.',
    }],
  }

  const enriched = await enrichPapersWithDownloadedEvidence(input, {
    tempDir: '/tmp/lumen-research-judgment-test',
    downloadPdf: async (url, path) => {
      downloads.push({ url, path })
      return { path, bytes: 42, cacheHit: false }
    },
    extractPdfText: async (path) => `FULL PDF TEXT from ${path}: Section 3 describes a cache-aware evidence loader, ablation experiments, and 37% fewer unsupported claims. The full paper text includes method details, system design constraints, evaluation setup, error analysis, and implementation risks that are unavailable in the abstract alone. `.repeat(3),
  })

  assert.equal(downloads[0].url, 'https://arxiv.org/pdf/1234.56789')
  assert.equal(enriched.papers[0].evidenceSource, 'pdf_text')
  assert.match(enriched.papers[0].pdfTempPath ?? '', /lumen-research-judgment-test/)
  assert.match(enriched.papers[0].fullText ?? '', /Section 3 describes a cache-aware evidence loader/)

  const report = buildResearchJudgmentReport(enriched)
  assert.match(report, /证据来源/)
  assert.match(report, /临时 PDF 文本/)
  assert.match(report, /Section 3 describes a cache-aware evidence loader/)
  assert.match(report, /lumen-research-judgment-test/)
})

test('classifies the evaluation papers into system bottlenecks', () => {
  const bottlenecks = evaluationPapers.map((paper) => classifyPaperBottleneck(paper).bottleneck)

  assert.deepEqual(bottlenecks, [
    'inference_efficiency',
    'training_efficiency',
    'long_term_memory',
    'social_risk',
  ])
})

test('ranks the papers by direct borrowing value for Lumen', () => {
  const judgments = evaluationPapers.map((paper) => classifyPaperBottleneck(paper))
  const ranked = rankLumenBorrowingValue(judgments)

  assert.equal(ranked[0].paper.title.startsWith('GSEM:'), true)
  assert.equal(ranked[1].paper.title.startsWith('SpecEyes:'), true)
  assert.equal(ranked[ranked.length - 1].paper.title.startsWith('Off-Policy'), true)
})

test('builds a report that answers the case as topic judgment, not summaries', () => {
  const report = buildResearchJudgmentReport({
    topic: '近期 AI Agent 系统的效率、经验沉淀与风险边界',
    papers: [...evaluationPapers],
  })

  assert.match(report, /选题判断/)
  assert.match(report, /系统瓶颈/)
  assert.match(report, /GSEM[\s\S]*长期记忆/)
  assert.match(report, /SpecEyes[\s\S]*推理效率/)
  assert.match(report, /Greater accessibility[\s\S]*社会风险/)
  assert.match(report, /Off-Policy[\s\S]*训练效率/)
  assert.match(report, /最值得 Lumen 借鉴/)
  assert.doesNotMatch(report, /逐篇总结/)
})

test('report exposes evidence matrix, synthesis thesis, and risk boundaries', () => {
  const report = buildResearchJudgmentReport({
    topic: '近期 AI Agent 系统的效率、经验沉淀与风险边界',
    papers: [...evaluationPapers],
  })

  assert.match(report, /证据映射矩阵/)
  assert.match(report, /研究对象/)
  assert.match(report, /核心机制/)
  assert.match(report, /关键指标或发现/)
  assert.match(report, /为什么归类/)
  assert.match(report, /Lumen 可迁移性/)

  assert.match(report, /综合判断/)
  assert.match(report, /经验层/)
  assert.match(report, /工具链延迟/)
  assert.match(report, /训练效率/)

  assert.match(report, /限制与风险边界/)
  assert.match(report, /强证据/)
  assert.match(report, /类比推断/)
  assert.match(report, /短期产品动作/)
  assert.match(report, /长期研究储备/)
})

test('report states contract, confidence rationale, and cross-paper gaps', () => {
  const report = buildResearchJudgmentReport({
    topic: '近期 AI Agent 系统的效率、经验沉淀与风险边界',
    papers: [...evaluationPapers],
  })

  assert.match(report, /报告任务契约/)
  assert.match(report, /面向 Lumen/)
  assert.match(report, /支持的决策/)
  assert.match(report, /输出边界/)

  assert.match(report, /置信度依据/)
  assert.match(report, /关键词命中/)
  assert.match(report, /标题与摘要信号/)
  assert.match(report, /非统计置信度/)

  assert.match(report, /张力与缺口/)
  assert.match(report, /能力增强与风险治理/)
  assert.match(report, /训练侧优化与产品侧可迁移性/)
  assert.match(report, /领域外推/)
})

test('report is a deep four-paper analysis with concrete mechanisms', () => {
  const report = buildResearchJudgmentReport({
    topic: '近期 AI Agent 系统的效率、经验沉淀与风险边界',
    papers: [...evaluationPapers],
  })

  assert.ok(report.length > 12000, `expected deep report, got ${report.length} characters`)
  assert.match(report, /四篇论文逐篇深读/)
  assert.match(report, /SpecEyes[\s\S]*agentic depth[\s\S]*answer separability[\s\S]*heterogeneous parallel funnel/)
  assert.match(report, /Off-Policy[\s\S]*logits as Q-values[\s\S]*Calibrated Initialization[\s\S]*replay buffer/)
  assert.match(report, /GSEM[\s\S]*Boundary Failure[\s\S]*Collaboration Failure[\s\S]*Q_i[\s\S]*W_ij/)
  assert.match(report, /Greater accessibility[\s\S]*speaker voice/)
  assert.match(report, /Greater accessibility[\s\S]*paralinguistic cues/)
  assert.match(report, /Greater accessibility[\s\S]*pitch manipulation/i)
  assert.match(report, /Lumen 具体改造方案/)
  assert.match(report, /数据结构/)
  assert.match(report, /评测方式/)
  assert.match(report, /不建议/)
})

test('generic reports do not reuse evaluation-paper hardcoded explanations', () => {
  const report = buildResearchJudgmentReport({
    topic: '研究 agent 工具链延迟',
    papers: [{
      title: 'FastPipe: Parallel Planning for Low-Latency Research Agents',
      abstractText: 'Research agents suffer latency from sequential search, browser, PDF parsing, and tool-calling loops. FastPipe proposes latency-aware parallel planning, early stopping when evidence is sufficient, and a scheduler that batches independent tool calls. Experiments on research QA tasks show 2.1x lower end-to-end latency while preserving evidence coverage.',
    }],
  })

  assert.match(report, /FastPipe/)
  assert.match(report, /latency-aware parallel planning/)
  assert.match(report, /research QA tasks/)
  assert.doesNotMatch(report, /SpecEyes/)
  assert.doesNotMatch(report, /V\* Bench/)
  assert.doesNotMatch(report, /HR-Bench/)
})

test('synthetic papers across bottlenecks do not leak evaluation-paper explanations', () => {
  const report = buildResearchJudgmentReport({
    topic: '泛化评测：训练、记忆和风险方向',
    papers: [
      {
        title: 'BatchWise: Reusable Feedback for Efficient Policy Tuning',
        abstractText: 'Long-horizon language agents waste samples when each policy update discards prior trajectories. BatchWise stores verified trajectories, reuses human feedback across related tasks, and compares sample efficiency on planning benchmarks with 18% fewer model calls.',
      },
      {
        title: 'MemoWeave: Relational Retrieval for Research Assistant Memory',
        abstractText: 'Research assistants lose continuity when notes, claims, and corrections are stored as isolated records. MemoWeave builds a relation graph over questions, evidence snippets, user corrections, and follow-up tasks, then updates retrieval weights from user feedback to reduce repeated mistakes.',
      },
      {
        title: 'VoiceGate: Consent-Aware Speech Interfaces for Research Tools',
        abstractText: 'Speech interfaces can improve accessibility but also expose identity cues. VoiceGate separates transcription from sensitive attribute inference, requires explicit consent before personalization, and reports lower unwanted demographic inference in a user study with n=640.',
      },
    ],
  })

  assert.match(report, /BatchWise/)
  assert.match(report, /MemoWeave/)
  assert.match(report, /VoiceGate/)
  assert.doesNotMatch(report, /SpecEyes|ReVal|GSEM|Greater accessibility/)
  assert.doesNotMatch(report, /V\* Bench|HR-Bench|AIME24|GPQA|MedR-Bench|MedAgentsBench/)
  assert.doesNotMatch(report, /Boundary Failure|Collaboration Failure|Q_i|W_ij|pitch manipulation/)
})

test('extracts abstract evidence from prompt instead of relying on known URLs', () => {
  const prompt = `主题：研究 agent 工具链延迟

论文：
1. FastPipe: Parallel Planning for Low-Latency Research Agents
   (https://example.org/fastpipe)
   摘要：Research agents suffer latency from sequential search, browser, PDF parsing, and tool-calling loops. FastPipe proposes latency-aware parallel planning, early stopping when evidence is sufficient, and a scheduler that batches independent tool calls. Experiments on research QA tasks show 2.1x lower end-to-end latency while preserving evidence coverage.

测什么：研究助理的选题判断力。判断这篇对应什么系统瓶颈：推理效率、训练效率、长期记忆、社会风险。`

  const report = tryBuildResearchJudgmentReportFromText(prompt)

  assert.equal(typeof report, 'string')
  assert.match(report ?? '', /FastPipe/)
  assert.match(report ?? '', /latency-aware parallel planning/)
  assert.match(report ?? '', /2.1x lower end-to-end latency/)
  assert.doesNotMatch(report ?? '', /SpecEyes/)
})

test('builds the evaluation report directly from the user prompt', () => {
  const prompt = `主题：近期 AI Agent 系统的效率、经验沉淀与风险边界

论文：
1. SpecEyes: Accelerating Agentic Multimodal LLMs via Speculative Perception and Pla
   nning (https://arxiv.org/abs/2603.23483v1)
2. Off-Policy Value-Based Reinforcement Learning for Large Language Models
   (https://arxiv.org/abs/2603.23355v1)
3. GSEM: Graph-based Self-Evolving Memory for Experience Augmented Clinical Reasoning
   (https://arxiv.org/abs/2603.22096v1)
4. Greater accessibility can amplify discrimination in generative AI
   (https://arxiv.org/abs/2603.22260v1)

测什么：研究助理的选题判断力。
不是要求逐篇总结，而是判断这四篇分别对应什么系统瓶颈：推理效率、训练效率、长期记忆、社会风险。然后排序：哪些最值得 Lumen 借鉴，为什么。`

  const report = tryBuildResearchJudgmentReportFromText(prompt)

  assert.equal(typeof report, 'string')
  assert.match(report ?? '', /近期 AI Agent 系统的效率、经验沉淀与风险边界/)
  assert.match(report ?? '', /GSEM[\s\S]*长期记忆/)
  assert.match(report ?? '', /SpecEyes[\s\S]*推理效率/)
  assert.match(report ?? '', /Greater accessibility[\s\S]*社会风险/)
  assert.match(report ?? '', /Off-Policy[\s\S]*训练效率/)
})

test('CLI runs the evaluation case without the GUI or AI config', async () => {
  const { stdout } = await execFileAsync('node', [
    '--experimental-strip-types',
    'scripts/research-judgment-cli.ts',
    '--prompt-file',
    'tests/fixtures/research-judgment-case.txt',
  ])

  assert.match(stdout, /选题判断/)
  assert.match(stdout, /系统瓶颈映射/)
  assert.match(stdout, /GSEM[\s\S]*长期记忆/)
  assert.match(stdout, /SpecEyes[\s\S]*推理效率/)
  assert.match(stdout, /Greater accessibility[\s\S]*社会风险/)
  assert.match(stdout, /Off-Policy[\s\S]*训练效率/)
  assert.match(stdout, /最值得 Lumen 借鉴/)
})
