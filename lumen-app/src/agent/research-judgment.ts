/**
 * [INPUT]: 依赖用户给出的论文标题、URL 和可选摘要/证据文本
 * [OUTPUT]: 对外提供论文系统瓶颈分类、Lumen 借鉴价值排序和 Markdown 报告生成
 * [POS]: agent 模块的研究判断层，补足 deep_research 之外的选题判断与借鉴排序能力
 */

export type ResearchBottleneck =
  | 'inference_efficiency'
  | 'training_efficiency'
  | 'long_term_memory'
  | 'social_risk'

export type LumenBorrowingTier = 'high' | 'medium' | 'watch'

export interface PaperJudgmentInput {
  title: string
  url?: string
  abstractText?: string | null
  fullText?: string | null
  evidenceSource?: 'pdf_text' | 'abstract' | 'metadata' | 'download_failed'
  pdfUrl?: string | null
  pdfTempPath?: string | null
  evidenceError?: string | null
}

export interface BottleneckJudgment {
  paper: PaperJudgmentInput
  bottleneck: ResearchBottleneck
  bottleneckLabel: string
  confidence: number
  signals: string[]
  rationale: string
  evidence: BottleneckEvidence
  deepReading: DeepReading
}

export interface LumenBorrowingRecommendation extends BottleneckJudgment {
  tier: LumenBorrowingTier
  rankScore: number
  borrowingRationale: string
  productMove: string
}

export interface ResearchJudgmentReportInput {
  topic: string
  papers: PaperJudgmentInput[]
}

interface BottleneckEvidence {
  researchObject: string
  coreMechanism: string
  keyFinding: string
  groupingReason: string
  lumenTransferability: string
}

interface DeepReading {
  sectionTitle: string
  problem: string
  mechanism: string[]
  evidence: string
  whyItMatters: string
  limitation: string
  lumenMapping: string[]
  doNotDo: string
}

interface BottleneckProfile {
  label: string
  rationale: string
  systemLayer: string
  keywords: string[]
  mechanismKeywords: string[]
  evidenceKeywords: string[]
  rankScore: number
  tier: LumenBorrowingTier
  borrowingRationale: string
  productMove: string
  doNotDo: string
  transferability: string
  genericResearchObject: string
}

const BOTTLENECK_PROFILES: Record<ResearchBottleneck, BottleneckProfile> = {
  inference_efficiency: {
    label: '推理效率',
    rationale: '它处理的是 agent 工具链、运行时推理、延迟、吞吐和并发问题，核心对象是用户等待的端到端执行链路。',
    systemLayer: 'agent runtime / serving layer',
    keywords: [
      'accelerating',
      'latency',
      'throughput',
      'speedup',
      'tool calling',
      'tool-calling',
      'sequential overhead',
      'parallel planning',
      'early stopping',
      'serving',
      'concurrency',
      'speculative',
      'scheduler',
    ],
    mechanismKeywords: [
      'planner',
      'planning',
      'gating',
      'parallel',
      'scheduler',
      'early stopping',
      'trajectory',
      'tool',
    ],
    evidenceKeywords: ['speedup', 'latency', 'throughput', 'concurrency', 'coverage', 'accuracy', 'benchmark', 'experiments', 'show'],
    rankScore: 90,
    tier: 'high',
    borrowingRationale: 'Lumen 的 deep research 会反复搜索、预览 PDF、抽证据和综合判断，最容易被串行工具链拖慢。运行时效率论文可转化为轻量规划、并行取证和提前停止。',
    productMove: '在 Research Agent 中加入轻量预判阶段：先预测需要读哪些论文和哪些章节，再并行拉取摘要/PDF 片段，最后只把高价值证据交给综合模型。',
    doNotDo: '不建议把推理效率论文简化成“换一个更快模型”。真正要迁移的是工具编排、并行执行、early stopping 和成本评测。',
    transferability: '高。只要论文讨论的是 agent 工具链延迟、并发吞吐或端到端执行成本，就能直接映射到 Lumen deep research 运行时。',
    genericResearchObject: 'Agent 工具调用和运行时推理链路',
  },
  training_efficiency: {
    label: '训练效率',
    rationale: '它处理的是训练阶段的数据利用率、轨迹复用、奖励信号、收敛效率和模型更新成本，核心对象是训练范式。',
    systemLayer: 'model training / post-training layer',
    keywords: [
      'off policy',
      'off-policy',
      'value based',
      'value-based',
      'reinforcement learning',
      'sample efficiency',
      'training efficiency',
      'trajectory',
      'reward',
    ],
    mechanismKeywords: ['reuse', 'reward', 'trajectory', 'policy', 'stepwise', 'outcome', 'verification', 'sample'],
    evidenceKeywords: ['improves', 'outperforms', 'converges', 'benchmark', 'efficiency', 'experiments', '%'],
    rankScore: 58,
    tier: 'watch',
    borrowingRationale: '训练效率对 Lumen 有启发，但当前 Lumen 主要通过用户 API key 调用外部模型。短期应先沉淀 agent 轨迹和用户反馈，作为未来训练或微调储备。',
    productMove: '记录 agent 轨迹、结果质量、用户采纳和用户修订内容，先做离线 replay benchmark，再讨论是否进入自有模型训练。',
    doNotDo: '不建议在没有自有模型、奖励设计和训练管线前直接实现训练论文里的 RL 算法。',
    transferability: '低到中。短期更多转化为轨迹记账和评测闭环，长期才可能进入微调或强化学习。',
    genericResearchObject: 'LLM 后训练和长程推理轨迹复用',
  },
  long_term_memory: {
    label: '长期记忆',
    rationale: '它处理的是经验如何被结构化、检索、复用、组合、校准和淘汰，核心对象是 agent 的长期经验层。',
    systemLayer: 'agent memory / experience layer',
    keywords: [
      'memory',
      'experience',
      'retrieval',
      'self-evolving',
      'online feedback',
      'graph',
      'applicability',
      'calibration',
      'reuse',
      'relational structure',
    ],
    mechanismKeywords: ['graph', 'retrieval', 'experience', 'quality', 'edge', 'node', 'feedback', 'calibration', 'condition', 'strategy'],
    evidenceKeywords: ['accuracy', 'benchmark', 'baselines', 'retrieval', 'outperforms', 'reaches', 'experiments', '%'],
    rankScore: 100,
    tier: 'high',
    borrowingRationale: 'Lumen 的长期价值不是单次回答，而是把论文、证据、判断、用户修订和失败路径沉淀成可复用经验。长期记忆论文最直接服务于“越用越懂研究者”。',
    productMove: '把 research_artifacts 从历史记录升级为经验图：节点是论文、问题、证据片段、判断和反馈；边是支持、反驳、相似、后续验证和用户否定。',
    doNotDo: '不建议只做“研究历史列表”或“收藏夹”。那只是存档，不是经验沉淀。',
    transferability: '很高。论文研究天然有问题、证据、判断、修订和反馈，适合沉淀为可演化经验图。',
    genericResearchObject: 'Agent 长期经验记忆和检索复用层',
  },
  social_risk: {
    label: '社会风险',
    rationale: '它处理的是能力扩展、可访问性、多模态输入或身份线索带来的公平、隐私、歧视和产品边界问题。',
    systemLayer: 'product policy / risk boundary layer',
    keywords: [
      'accessibility',
      'discrimination',
      'bias',
      'fairness',
      'voice',
      'speech',
      'gender',
      'identity cues',
      'social bias',
      'equitable',
      'attribute inference',
      'privacy',
    ],
    mechanismKeywords: ['voice', 'speech', 'gender', 'attribute', 'inference', 'survey', 'accessibility', 'fairness'],
    evidenceKeywords: ['survey', 'n=', 'bias', 'discrimination', 'amplifying', 'gender', 'outputs', 'evidence', 'shows', 'systematic'],
    rankScore: 72,
    tier: 'medium',
    borrowingRationale: '社会风险论文不一定提升研究质量，但会定义 Lumen 扩展语音、多模态和协作输入时必须遵守的边界，避免“更易用”反而引入身份推断和差别对待。',
    productMove: '在设置和 agent policy 中增加敏感属性约束：默认不从声音、图像或输入方式推断身份属性；需要时必须显式授权并标注不确定性。',
    doNotDo: '不建议为了“更懂用户”默认保留或利用声音、图像、输入方式中的敏感身份线索。',
    transferability: '中。对当前文本研究流不是主线，但对未来语音、多模态输入和协作场景的 policy 设计必须前置。',
    genericResearchObject: 'AI 产品可访问性、公平性和身份推断风险',
  },
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff%.+-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function sourceText(paper: PaperJudgmentInput): string {
  return [paper.title, paper.url ?? '', paper.abstractText ?? '', paper.fullText ?? ''].join(' ')
}

function paperEvidenceText(paper: PaperJudgmentInput): string | null | undefined {
  return paper.fullText?.trim() || paper.abstractText
}

function scoreBottleneck(text: string, bottleneck: ResearchBottleneck): { score: number; signals: string[] } {
  const normalized = normalizeText(text)
  const signals = BOTTLENECK_PROFILES[bottleneck].keywords.filter((keyword) => normalized.includes(normalizeText(keyword)))
  return {
    score: signals.length,
    signals,
  }
}

function fallbackBottleneck(text: string): ResearchBottleneck {
  const normalized = normalizeText(text)
  if (/latency|throughput|speedup|tool calling|tool-calling|parallel/.test(normalized)) return 'inference_efficiency'
  if (/reinforcement learning|training|reward|trajectory|policy/.test(normalized)) return 'training_efficiency'
  if (/memory|retrieval|experience|graph/.test(normalized)) return 'long_term_memory'
  if (/risk|bias|fairness|discrimination|voice|privacy/.test(normalized)) return 'social_risk'
  return 'long_term_memory'
}

function confidenceFor(score: number, hasAbstract: boolean): number {
  const abstractBonus = hasAbstract ? 0.04 : 0
  if (score >= 5) return Math.min(0.96, 0.91 + abstractBonus)
  if (score >= 3) return Math.min(0.90, 0.84 + abstractBonus)
  if (score >= 1) return Math.min(0.78, 0.70 + abstractBonus)
  return hasAbstract ? 0.60 : 0.52
}

export function detectResearchJudgmentRequest(text: string): boolean {
  const normalized = normalizeText(text)
  const hasJudgmentSignal = /选题判断|系统瓶颈|借鉴|排序|风险边界|经验沉淀/.test(normalized)
  const hasBottleneckSet = /推理效率/.test(normalized)
    && /训练效率/.test(normalized)
    && /长期记忆/.test(normalized)
    && /社会风险/.test(normalized)
  const asksOnlySummary = /总结|summary/.test(normalized) && !hasJudgmentSignal
  return !asksOnlySummary && (hasJudgmentSignal || hasBottleneckSet)
}

function splitSentences(text: string | null | undefined): string[] {
  return (text ?? '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[。！？!?])\s+|(?<=\.)\s+(?=[A-Z])|(?<=;)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function sentenceWith(sentences: string[], keywords: string[], fallback: string): string {
  const normalizedKeywords = keywords.map(normalizeText)
  return sentences.find((sentence) => {
    const normalized = normalizeText(sentence)
    return normalizedKeywords.some((keyword) => normalized.includes(keyword))
  }) ?? fallback
}

function evidenceSentence(sentences: string[], fallback: string): string {
  return sentences.find((sentence) => /(?:\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?x|n\s*=|n=)/i.test(sentence))
    ?? sentenceWith(
      sentences,
      ['experiments', 'experiment', 'benchmark', 'show', 'shows', 'shown', 'improve', 'improves', 'outperforms', 'reaches', 'accuracy', 'speedup'],
      fallback,
    )
}

function sentencesWith(sentences: string[], keywords: string[], limit: number): string[] {
  const normalizedKeywords = keywords.map(normalizeText)
  const picked = sentences.filter((sentence) => {
    const normalized = normalizeText(sentence)
    return normalizedKeywords.some((keyword) => normalized.includes(keyword))
  })
  return picked.slice(0, limit)
}

function titleLead(title: string): string {
  return title.split(':')[0].trim() || title
}

function buildEvidence(
  paper: PaperJudgmentInput,
  bottleneck: ResearchBottleneck,
  signals: string[],
): BottleneckEvidence {
  const profile = BOTTLENECK_PROFILES[bottleneck]
  const text = paperEvidenceText(paper)
  const sentences = splitSentences(text)
  const fallback = text
    ? `输入证据显示这篇论文围绕 ${profile.systemLayer} 展开。`
    : '输入没有提供摘要或证据文本；以下判断主要来自标题和瓶颈关键词，证据强度较弱。'
  const mechanism = sentenceWith(sentences, profile.mechanismKeywords, fallback)
  const finding = evidenceSentence(sentences, sentenceWith(sentences, profile.evidenceKeywords, fallback))

  return {
    researchObject: sentenceWith(sentences, ['agent', 'llm', 'model', 'system', 'interaction', 'agents'], profile.genericResearchObject),
    coreMechanism: mechanism,
    keyFinding: finding,
    groupingReason: `标题和证据文本命中了 ${signals.length > 0 ? signals.join(', ') : '少量弱信号'}，这些信号主要落在 ${profile.systemLayer}，因此归入${profile.label}。`,
    lumenTransferability: profile.transferability,
  }
}

function buildDeepReading(
  paper: PaperJudgmentInput,
  bottleneck: ResearchBottleneck,
  evidence: BottleneckEvidence,
  signals: string[],
): DeepReading {
  const profile = BOTTLENECK_PROFILES[bottleneck]
  const text = paperEvidenceText(paper)
  const sentences = splitSentences(text)
  const problem = sentenceWith(
    sentences,
    ['problem', 'however', 'challenge', 'barrier', 'suffer', 'cost', 'inefficiency', 'risk', 'failure', '瓶颈', '问题'],
    text
      ? `${titleLead(paper.title)} 的摘要没有直接用“problem/challenge”表述，但其核心证据指向 ${profile.rationale}`
      : `输入没有提供摘要，系统只能从标题和 URL 判断它可能讨论 ${profile.rationale}`,
  )
  const mechanismSentences = sentencesWith(sentences, profile.mechanismKeywords, 4)
  const mechanism = mechanismSentences.length > 0
    ? mechanismSentences
    : [`输入证据不足以还原完整方法细节；当前只能确认它与 ${signals.join(', ') || profile.label} 相关，后续应补充摘要、PDF 或方法段。`]
  const evidenceText = evidenceSentence(sentences, evidence.keyFinding)

  return {
    sectionTitle: `${paper.title}：${profile.label}视角下的深读`,
    problem: `${problem} 这意味着它不是一个孤立技巧，而是在处理 ${profile.systemLayer} 的系统瓶颈。`,
    mechanism,
    evidence: evidenceText,
    whyItMatters: `这篇论文对 Lumen 的意义在于：${profile.borrowingRationale} 具体到本文，最可用的信号是 ${signals.slice(0, 5).join(', ') || '标题与摘要中的系统瓶颈描述'}。`,
    limitation: paper.fullText?.trim()
      ? `当前分析读取了临时 PDF 文本（${paper.pdfTempPath ?? '临时文件路径未记录'}），但仍需要注意 PDF 抽文本可能丢失公式、图表、表格和版面结构；正式结论仍应回查原文关键段落、实验设置、消融和失败案例。`
      : text
        ? `当前分析主要依据标题和摘要/证据文本，不等同于完整 PDF 精读。需要进一步检查实验设置、消融、失败案例和适用边界，尤其要确认它是否能从原论文场景迁移到 Lumen 的论文研究任务。`
        : `缺少摘要和正文证据，不能给出强结论。若要形成正式深度报告，必须先获取摘要、方法段、实验结果和限制段。`,
    lumenMapping: [
      `数据结构：围绕 ${profile.systemLayer} 记录可验证字段，避免只保存一段自然语言结论。`,
      `产品动作：${profile.productMove}`,
      `评测方式：为该类瓶颈建立离线 benchmark，比较报告质量、用户修订量、端到端成本和失败复现率。`,
    ],
    doNotDo: profile.doNotDo,
  }
}

export function classifyPaperBottleneck(paper: PaperJudgmentInput): BottleneckJudgment {
  const text = sourceText(paper)
  const scored = (Object.keys(BOTTLENECK_PROFILES) as ResearchBottleneck[])
    .map((bottleneck) => ({
      bottleneck,
      ...scoreBottleneck(text, bottleneck),
    }))
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  const bottleneck = best.score > 0 ? best.bottleneck : fallbackBottleneck(text)
  const signals = best.score > 0 ? best.signals : ['title_or_abstract_prior']
  const evidence = buildEvidence(paper, bottleneck, signals)

  return {
    paper,
    bottleneck,
    bottleneckLabel: BOTTLENECK_PROFILES[bottleneck].label,
    confidence: confidenceFor(best.score, Boolean(paperEvidenceText(paper)?.trim())),
    signals,
    rationale: BOTTLENECK_PROFILES[bottleneck].rationale,
    evidence,
    deepReading: buildDeepReading(paper, bottleneck, evidence, signals),
  }
}

function borrowingFor(judgment: BottleneckJudgment): {
  tier: LumenBorrowingTier
  rankScore: number
  borrowingRationale: string
  productMove: string
} {
  const profile = BOTTLENECK_PROFILES[judgment.bottleneck]
  return {
    tier: profile.tier,
    rankScore: profile.rankScore + Math.round(judgment.confidence * 5),
    borrowingRationale: profile.borrowingRationale,
    productMove: profile.productMove,
  }
}

export function rankLumenBorrowingValue(judgments: BottleneckJudgment[]): LumenBorrowingRecommendation[] {
  return judgments
    .map((judgment) => ({
      ...judgment,
      ...borrowingFor(judgment),
    }))
    .sort((a, b) => b.rankScore - a.rankScore)
}

function paperLink(paper: PaperJudgmentInput): string {
  return paper.url ? `[${paper.title}](${paper.url})` : paper.title
}

function evidenceSourceLabel(paper: PaperJudgmentInput): string {
  if (paper.evidenceSource === 'pdf_text' || paper.fullText?.trim()) return '临时 PDF 文本'
  if (paper.evidenceSource === 'download_failed') return 'PDF 下载或抽取失败，退回摘要/元数据'
  if (paper.abstractText?.trim()) return '摘要'
  return '元数据'
}

function evidenceSourceDetail(paper: PaperJudgmentInput): string {
  if (paper.evidenceSource === 'pdf_text' || paper.fullText?.trim()) {
    return paper.pdfTempPath ? `PDF URL: ${paper.pdfUrl ?? '未知'}；临时文件: ${paper.pdfTempPath}` : `PDF URL: ${paper.pdfUrl ?? '未知'}`
  }
  if (paper.evidenceSource === 'download_failed') {
    return `PDF URL: ${paper.pdfUrl ?? '未知'}；错误: ${paper.evidenceError ?? '未知错误'}`
  }
  return paper.url ? `来源 URL: ${paper.url}` : '未提供 URL'
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`
}

function confidenceRationale(judgment: BottleneckJudgment): string {
  const signalPreview = judgment.signals.slice(0, 5).join(', ')
  return `非统计置信度；由标题与摘要信号、证据文本、关键词命中（${signalPreview}）共同给出。`
}

function formatDeepReading(judgment: BottleneckJudgment): string {
  const mechanismLines = judgment.deepReading.mechanism.map((item) => `- ${item}`).join('\n')
  const lumenLines = judgment.deepReading.lumenMapping.map((item) => `- ${item}`).join('\n')

  return `### ${judgment.deepReading.sectionTitle}

**对应瓶颈**：${judgment.bottleneckLabel}。

**它真正要解决的问题**：${judgment.deepReading.problem}

**机制拆解**：
${mechanismLines}

**证据与结果**：${judgment.deepReading.evidence}

**为什么这不是普通摘要里的“方法名”**：${judgment.deepReading.whyItMatters}

**局限**：${judgment.deepReading.limitation}

**Lumen 具体改造方案**：
${lumenLines}

**不建议**：${judgment.deepReading.doNotDo}`
}

function cleanUrl(value: string): string {
  return value.replace(/[)\]，。,.]+$/g, '')
}

function canonicalTitle(title: string): string {
  return title.replace(/\s+/g, ' ').replace(/\s+([,.:;])/g, '$1').trim()
}

function extractTopic(text: string): string {
  const topic = text.match(/主题[:：]\s*([^\n]+)/)?.[1]?.trim()
  return topic || '论文研究主题'
}

function stripAbstractPrefix(value: string): string {
  return value.replace(/^\s*(?:摘要|Abstract)\s*[:：]\s*/i, '').trim()
}

function parseNumberedPaperBlock(block: string): PaperJudgmentInput | null {
  const urlMatch = block.match(/https?:\/\/[^\s)]+/)
  if (!urlMatch) return null

  const url = cleanUrl(urlMatch[0])
  const beforeUrl = block.slice(0, urlMatch.index).replace(/[()]/g, ' ')
  const afterUrl = block.slice((urlMatch.index ?? 0) + urlMatch[0].length).replace(/^\s*\)?/, '')
  const abstractMatch = afterUrl.match(/(?:摘要|Abstract)\s*[:：]\s*([\s\S]*)/i)
  const abstractText = abstractMatch ? stripAbstractPrefix(abstractMatch[0]) : null
  const rawTitle = beforeUrl.replace(/\s+/g, ' ').trim()

  return {
    title: canonicalTitle(rawTitle || url),
    url,
    abstractText: abstractText || null,
  }
}

export function extractResearchJudgmentInput(text: string): ResearchJudgmentReportInput | null {
  if (!detectResearchJudgmentRequest(text)) return null

  const papers: PaperJudgmentInput[] = []
  const seenUrls = new Set<string>()
  const body = text.match(/论文[:：]([\s\S]*?)(?:\n\s*测什么[:：]|$)/)?.[1] ?? text
  const numberedPaper = /(?:^|\n)\s*[0-9]+\.\s*([\s\S]*?)(?=\n\s*[0-9]+\.|\n\s*测什么[:：]|$)/g

  for (const match of body.matchAll(numberedPaper)) {
    const paper = parseNumberedPaperBlock(match[1])
    if (!paper || seenUrls.has(paper.url ?? paper.title)) continue
    seenUrls.add(paper.url ?? paper.title)
    papers.push(paper)
  }

  if (papers.length === 0) {
    for (const match of text.matchAll(/https?:\/\/[^\s)]+/g)) {
      const url = cleanUrl(match[0])
      if (seenUrls.has(url)) continue
      seenUrls.add(url)
      papers.push({ title: url, url })
    }
  }

  if (papers.length === 0) return null
  return {
    topic: extractTopic(text),
    papers,
  }
}

export function tryBuildResearchJudgmentReportFromText(text: string): string | null {
  const input = extractResearchJudgmentInput(text)
  return input ? buildResearchJudgmentReport(input) : null
}

function countLabel(count: number): string {
  const labels: Record<number, string> = { 1: '一篇', 2: '两篇', 3: '三篇', 4: '四篇' }
  return labels[count] ?? `${count} 篇`
}

function formatList(values: string[]): string {
  return [...new Set(values)].join('、')
}

export function buildResearchJudgmentReport(input: ResearchJudgmentReportInput): string {
  const judgments = input.papers.map((paper) => classifyPaperBottleneck(paper))
  const ranked = rankLumenBorrowingValue(judgments)
  const bottleneckLabels = formatList(judgments.map((judgment) => judgment.bottleneckLabel))
  const topNames = ranked.slice(0, 2).map((item) => `**${item.paper.title}**`).join(' 和 ')
  const mappingRows = judgments.map((judgment) => (
    `| ${paperLink(judgment.paper)} | ${judgment.bottleneckLabel} | ${formatConfidence(judgment.confidence)} | ${judgment.rationale} |`
  ))
  const evidenceRows = judgments.map((judgment) => (
    `| ${paperLink(judgment.paper)} | ${judgment.evidence.researchObject} | ${judgment.evidence.coreMechanism} | ${judgment.evidence.keyFinding} | ${judgment.bottleneckLabel} | ${judgment.evidence.groupingReason} | ${judgment.evidence.lumenTransferability} |`
  ))
  const confidenceRows = judgments.map((judgment) => (
    `| ${paperLink(judgment.paper)} | ${formatConfidence(judgment.confidence)} | ${confidenceRationale(judgment)} |`
  ))
  const evidenceSourceRows = judgments.map((judgment) => (
    `| ${paperLink(judgment.paper)} | ${evidenceSourceLabel(judgment.paper)} | ${evidenceSourceDetail(judgment.paper)} |`
  ))
  const rankingLines = ranked.map((item, index) => (
    `${index + 1}. **${item.paper.title}**（${item.bottleneckLabel}，${item.tier}）\n   - 为什么值得借鉴：${item.borrowingRationale}\n   - Lumen 可落地动作：${item.productMove}`
  ))
  const deepReadingSections = judgments.map((judgment) => formatDeepReading(judgment))

  return `# 选题判断：${input.topic}

## 报告任务契约
- **面向 Lumen**：这份报告服务于 Lumen Research Agent 的产品与研究路线判断，不服务于论文课堂式复述。
- **支持的决策**：判断输入论文分别暴露什么 agent 系统瓶颈，并给出 Lumen 短期应借鉴什么、长期应储备什么。
- **输出边界**：只做跨论文系统判断、证据映射、借鉴排序和风险边界；不替代正式 systematic review。若输入缺少摘要或正文证据，报告会降低置信度并标注证据不足。

## 证据来源
| 论文 | Evidence level | 来源细节 |
| --- | --- | --- |
${evidenceSourceRows.join('\n')}

## 核心结论
这${countLabel(input.papers.length)}论文主要覆盖的 AI Agent 系统瓶颈是：${bottleneckLabels}。对 Lumen 来说，当前最值得优先检查的是 ${topNames || '输入论文中证据最充分的方向'}。排序不是按论文名预设，而是按输入标题、摘要/证据文本和瓶颈体系共同判断。

## 综合判断
这组论文反映的主线是：AI Agent 的质量不只来自单次模型能力，还取决于运行时效率、训练数据效率、可复用经验层和产品风险边界。Lumen 的优先级应当从输入论文暴露的瓶颈出发：能直接改善研究体验的运行时和记忆能力优先，依赖自有模型训练基础设施的方向先做数据沉淀，涉及敏感身份或多模态输入的方向先定义 policy 和评测边界。

## 张力与缺口
- **能力增强与风险治理的张力**：提高 agent 能力、降低使用门槛或增加输入模态，都可能同时引入新的风险面。
- **训练侧优化与产品侧可迁移性的张力**：训练效率论文可能技术价值很高，但如果 Lumen 当前没有训练管线，短期只能转化为轨迹数据和评测资产。
- **领域外推缺口**：任何来自视觉、临床、语音或数学推理场景的结果，迁移到论文研究前都需要用 Lumen 自有任务复测。

## ${countLabel(input.papers.length)}论文逐篇深读
${deepReadingSections.join('\n\n')}

## 系统瓶颈映射
| 论文 | 系统瓶颈 | 置信度 | 判断理由 |
| --- | --- | ---: | --- |
${mappingRows.join('\n')}

## 证据映射矩阵
| 论文 | 研究对象 | 核心机制 | 关键指标或发现 | 系统瓶颈 | 为什么归类 | Lumen 可迁移性 |
| --- | --- | --- | --- | --- | --- | --- |
${evidenceRows.join('\n')}

## 置信度依据
| 论文 | 置信度 | 依据 |
| --- | ---: | --- |
${confidenceRows.join('\n')}

## 最值得 Lumen 借鉴
${rankingLines.join('\n\n')}

## 对 Lumen 的取舍
- **先借鉴能直接改善研究循环的系统层能力**：例如运行时工具编排、证据选择、经验复用和反馈校准。
- **训练效率先记账，不急着训练**：当前阶段更现实的是记录高质量轨迹与反馈，为未来训练或微调准备数据。
- **风险边界要跟能力一起设计**：语音、多模态和协作输入上线前，应先定义敏感属性推断、披露和用户授权规则。
- **所有迁移都要经过 Lumen 自有评测**：论文里的 benchmark 只能说明原任务成立，不能自动证明 Lumen 场景也成立。

## 限制与风险边界
- **强证据**：标题、摘要和用户提供的证据文本足以支持初步瓶颈归类；但没有阅读全文时，不应把它当作最终论文审稿。
- **类比推断**：从原论文任务迁移到 Lumen 的论文研究场景，属于架构类比，需要端到端验证。
- **短期产品动作**：优先做不依赖自有模型训练的结构化记录、评测回放、并行取证、经验图和风险 policy。
- **长期研究储备**：需要自有模型、训练管线或多模态能力的方向，先沉淀数据和评测，再进入实现。`
}
