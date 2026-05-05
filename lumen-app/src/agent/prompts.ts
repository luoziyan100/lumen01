/**
 * [INPUT]: 依赖 agent/types
 * [OUTPUT]: 对外提供 Research Harness 的 planner/reflector/synthesizer prompt 构造函数
 * [POS]: agent 模块的提示词集中存放点，方便后续 feedback loop 写回规则
 */
import type { AgentInputContext, PaperEvidenceNote, ResolvedUserQuestion, SearchBatch, SearchPlan, SearchReflection } from './types'
import { formatSearchBatches, hasExplicitCurrentPaperAnchor, hasStrongResultSetAnchor, mergeSearchBatches } from './tools.ts'
import { formatSearchResults, type SearchResult } from '../services/search.ts'
import { toolManifestForPlanner } from './tool-manifest.ts'

export const PLANNER_SYSTEM_PROMPT = `你是 Lumen 的研究 Agent 调度器。你只负责判断用户当前输入需要哪个动作，不直接回答长篇内容。

返回严格 JSON，不要 Markdown，不要解释。Schema:
{
  "intent": "academic_search" | "paper_detail" | "paper_preview" | "deep_research" | "import_to_library" | "local_research" | "answer" | "feedback" | "clarify",
  "shouldSearch": boolean,
  "queries": string[],
  "target": "none" | "resolved_result_set_items",
  "evidenceRequirement": "metadata_ok" | "abstract_ok" | "single_pdf_required" | "multi_pdf_required",
  "targetPaperCount": number,
  "searchMode": "keyword_search" | "paper_lookup" | "recent_ai_feed" | "arxiv_category_feed",
  "sourceHint": "all" | "arxiv" | "openalex" | "semantic_scholar" | "crossref",
  "categoryPreset": "ai" | "llm" | "vision" | "robotics" | "custom",
  "arxivCategories": string[],
  "feedLimit": number,
  "includeTotalCount": boolean,
  "response": string,
  "reason": string,
  "localPaperRequest": {
    "target": "current_library" | "selected_paper" | "project" | "collection",
    "query": string
  },
  "paperReference": {
    "resultIndex": number,
    "title": string,
    "doi": string,
    "sourceUrl": string,
    "openAccessUrl": string
  },
  "recencyIntent": "none" | "latest" | "this_week" | "recent_days" | "this_year" | "custom_range",
  "timeRange": {
    "fromDate": "YYYY-MM-DD",
    "untilDate": "YYYY-MM-DD"
  },
  "sortMode": "relevance" | "newest" | "balanced"
}

决策规则：
- 如果用户只是问当前年份、日期、你是谁、能做什么、普通闲聊或一般知识，intent=answer，shouldSearch=false，不要读取本地论文。
- 如果用户明确要求分析、总结、对比、阅读本地论文库、某篇论文、某个项目或集合，intent=local_research，shouldSearch=false，并填写 localPaperRequest。
- 只有当用户确实要找外部论文、验证某篇论文、推荐文献、补充研究材料、最新论文，或当前文献库不足以回答时，才设置 intent=academic_search 和 shouldSearch=true。
- 作者、年份、DOI、链接、期刊等元信息问题设置 evidenceRequirement=metadata_ok；摘要层概览、推荐列表设置 abstract_ok。
- 如果用户引用最近搜索结果中的“这篇 / 那篇 / 第 N 篇 / 刚才那篇 / 某个标题 / DOI / R1-1”，并询问作者、年份、DOI、期刊、摘要、链接、有没有 PDF 等元信息，intent=paper_detail，shouldSearch=false，并填写 paperReference。
- 如果用户引用最近搜索结果中的论文，并询问“讲什么、方法、实验、结论、贡献、局限、理论、为什么重要、和另一篇有什么区别”等内容问题，intent=paper_preview，shouldSearch=false，并填写 paperReference。用户不必显式说“读”。
- 如果用户说“刚才/上一轮/上面/你筛出来的/这些/那 10 篇/前 5 篇/R1/R1-1”这类已有结果集引用，默认复用上下文里的 search result set，shouldSearch=false；只有用户明确说“重新搜、再搜、换一批、重新查”才允许新搜索。
- 如果上下文里已有 resolvedResultSetReference，系统已经确定了用户指向哪些论文；你只判断用户想做什么，并设置 target=resolved_result_set_items、shouldSearch=false，不要再从聊天文本里猜论文身份。
- 用户说“找/搜索论文并解释、总结、分析、对比、方法、实验、结论、贡献、局限、定义、理论”时，不是纯推荐列表；intent 仍可为 academic_search，但 evidenceRequirement 必须是 single_pdf_required 或 multi_pdf_required。
- 多篇论文对比、综述、深读、综合方法/结论时设置 evidenceRequirement=multi_pdf_required，并按用户需求填写 targetPaperCount，最多 5；未明确数量时默认 3。
- 只有当 resolvedQuestion.referencedPapers、resolvedResultSetReference，或用户明确说“这篇论文/这个论文/当前论文/刚才那篇论文/R1-1/第 N 篇”时，才允许绑定已有论文对象。裸“它/这个/那个”不能自动指向旧 currentPaper。
- 如果用户要求“深入对比这几篇 / 深读这些论文”，intent=deep_research，evidenceRequirement=multi_pdf_required。只允许临时读取开放 PDF，不导入文献库。
- 只有用户明确说“保存、加入文献库、导入文献库、下载到本地、本地保存 PDF”，才设置 intent=import_to_library；普通“总结/讲什么/方法是什么”不是导入意图。
- 如果用户是在评价上一轮搜索质量、纠错、追问为什么不准确、或要求调整策略，这是 feedback，不要搜索。
- 如果需要搜索，把用户意图改写成 1-3 条英文 scholarly query；优先保留论文标题、作者、年份、领域术语、DOI/arXiv ID。
- 如果用户问“最近/本周/这周/上周/某日期以来 AI 领域论文有哪些、一共有多少、arXiv 上有什么新论文”，不要生成 query="AI" 做 keyword_search；设置 searchMode=recent_ai_feed，sourceHint=arxiv，categoryPreset=ai，arxivCategories=["cs.AI","cs.LG","cs.CL","cs.CV","cs.RO","stat.ML"]，并填写 timeRange、feedLimit、includeTotalCount。
- 如果用户指定 arXiv 分类，例如 cs.CL / cs.LG / cs.CV，设置 searchMode=arxiv_category_feed，sourceHint=arxiv，并填写 arxivCategories。
- 如果用户只是要推荐少量相关论文，例如“推荐 10 篇最近 LLM 论文，不用详细分析”，可以使用 keyword_search；只有“领域新论文/一共有多少/feed/某日期以来”才用 feed 模式。
- 如果用户提到“最新、近期、最近、本周、这周、最近7天、今年、刚发、new papers、latest papers”，不要只在 query 里写 recent；必须填 recencyIntent、timeRange 和 sortMode。
- 本周/这周按输入上下文里的本地日期和时区解析；最近7天从当前日期往前 7 天；今年从当年 1 月 1 日到当前日期；最新/近期默认最近 30 天。
- 有明确时效意图时 sortMode=newest；经典/高影响/综述推荐优先 sortMode=relevance 或 balanced。
- 如果“这篇/它/那篇”无法解析到唯一搜索结果，intent=clarify，并让用户选择第几篇。
- paper_preview 和 deep_research 默认只允许临时读取开放 PDF，不进入文献库。
- 如果问题含糊但需要更多信息，intent=clarify，并在 response 中提出一个简短澄清问题。
- response 只在 feedback 或 clarify 时填写；其他情况可以为空。`

export const REFLECTION_SYSTEM_PROMPT = `你是学术搜索结果评估器。判断当前搜索结果是否足以回答用户问题。

返回严格 JSON，不要 Markdown。Schema:
{
  "status": "sufficient" | "retry" | "not_found",
  "revisedQueries": string[],
  "reason": string
}

如果结果明显跑题，给出 1-2 条更精准的英文 revisedQueries。只允许重试一次，因此 revisedQueries 要尽量高质量。
如果搜索计划包含 timeRange，必须检查结果是否满足时间范围；主题相关但时间不满足，也应该 retry 或在 reason 中说明 time_range_mismatch。`

function plannerPaperSummary(paper: SearchResult) {
  return {
    title: paper.title,
    authors: paper.authors.map((author) => author.name).slice(0, 4),
    date: paper.published_date ?? paper.year,
    doi: paper.doi,
    source: paper.source,
    sourceUrl: paper.source_url,
    openAccessUrl: paper.open_access_pdf_url ?? paper.open_access_url,
    openAccessLandingUrl: paper.open_access_landing_url,
    hasOpenAccessPdf: Boolean(paper.open_access_pdf_url ?? paper.open_access_url),
    abstractSnippet: paper.abstract_text?.slice(0, 280),
  }
}

function paperIdentity(paper: SearchResult): string {
  if (paper.doi) return `doi:${paper.doi.toLowerCase()}`
  return `title:${paper.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`
}

function plannerCurrentPaperSource(
  context: AgentInputContext,
  referencedPapers: SearchResult[],
  userText: string,
): SearchResult | null {
  if (referencedPapers.length === 1) return referencedPapers[0]
  if (!context.currentPaper) return null
  if (!hasExplicitCurrentPaperAnchor(userText)) return null
  const currentIdentity = paperIdentity(context.currentPaper)
  if (referencedPapers.length === 0 || referencedPapers.some((paper) => paperIdentity(paper) === currentIdentity)) {
    return context.currentPaper
  }
  return null
}

function plannerResolvedQuestion(
  resolvedQuestion: ResolvedUserQuestion | undefined,
  referencedPapers: SearchResult[],
  userText: string,
): ResolvedUserQuestion | undefined {
  if (!resolvedQuestion) return undefined
  if (referencedPapers.length > 0 || resolvedQuestion.referencedResultSetId || hasExplicitCurrentPaperAnchor(userText)) {
    return resolvedQuestion
  }

  const safeQuestion: ResolvedUserQuestion = { ...resolvedQuestion }
  delete safeQuestion.currentPaper
  delete safeQuestion.referencedPapers
  return safeQuestion
}

export function buildPlannerUserPrompt(
  context: AgentInputContext,
  recentMessages: string,
  userText: string,
): string {
  const referencedPapers = context.resolvedQuestion?.referencedPapers ?? []
  const exposeResultSets = Boolean(context.resolvedResultSetReference || hasStrongResultSetAnchor(userText))
  const currentPaperSource = plannerCurrentPaperSource(context, referencedPapers, userText)
  const currentPaper = currentPaperSource ? plannerPaperSummary(currentPaperSource) : null
  const lastSearchResults = (exposeResultSets ? context.lastSearchResults ?? [] : []).slice(0, 12).map((result, index) => ({
    index: index + 1,
    title: result.title,
    authors: result.authors.map((author) => author.name).slice(0, 4),
    date: result.published_date ?? result.year,
    doi: result.doi,
    source: result.source,
    sourceUrl: result.source_url,
    openAccessUrl: result.open_access_pdf_url ?? result.open_access_url,
    openAccessLandingUrl: result.open_access_landing_url,
    hasOpenAccessPdf: Boolean(result.open_access_pdf_url ?? result.open_access_url),
    abstractSnippet: result.abstract_text?.slice(0, 280),
  }))
  const recentSearchResultSets = (exposeResultSets ? context.recentSearchResultSets ?? [] : []).slice(0, 10).map((set) => ({
    id: set.id,
    label: set.label,
    active: set.id === context.activeSearchResultSetId,
    query: set.query,
    mode: set.mode,
    totalAvailable: set.totalAvailable,
    fetched: set.fetched,
    categories: set.categories,
    fromDate: set.fromDate,
    untilDate: set.untilDate,
    resultCount: set.results.length,
    topResults: set.results.slice(0, 8).map((result, index) => ({
      stableIndex: `${set.label}-${index + 1}`,
      title: result.title,
      authors: result.authors.map((author) => author.name).slice(0, 4),
      date: result.published_date ?? result.year,
      doi: result.doi,
      source: result.source,
      sourceUrl: result.source_url,
      openAccessUrl: result.open_access_pdf_url ?? result.open_access_url,
      hasOpenAccessPdf: Boolean(result.open_access_pdf_url ?? result.open_access_url),
    })),
  }))
  const resolvedQuestion = plannerResolvedQuestion(context.resolvedQuestion, referencedPapers, userText)
  return `当前上下文：
${JSON.stringify({
  currentDate: context.currentDate,
  timezone: context.timezone,
  hasLocalPapers: context.hasLocalPapers,
  localPaperCount: context.localPaperCount,
  activeProjectName: context.activeProjectName,
  selectedPaperTitle: context.selectedPaperTitle,
  currentPaper,
  resolvedQuestion,
  resolvedResultSetReference: context.resolvedResultSetReference,
  activeSearchResultSetId: context.activeSearchResultSetId,
  recentSearchResultSets,
  lastSearchResults,
  toolManifest: toolManifestForPlanner(),
}, null, 2)}

最近对话：
${recentMessages || '（无）'}

当前用户输入：
${userText}`
}

export function buildReflectionUserPrompt(
  userText: string,
  plan: SearchPlan,
  batches: SearchBatch[],
): string {
  return `用户问题：
${userText}

原搜索计划：
${JSON.stringify(plan, null, 2)}

搜索结果：
${formatSearchBatches(batches, 8)}`
}

export function buildSynthesisUserPrompt(
  userText: string,
  plan: SearchPlan,
  batches: SearchBatch[],
  reflection?: SearchReflection,
): string {
  const mergedResults = mergeSearchBatches(batches, 12)
  const searchContext = formatSearchResults(mergedResults)
  const feedContext = batches
    .filter((batch) => batch.mode === 'recent_ai_feed' || batch.mode === 'arxiv_category_feed')
    .map((batch) => ({
      mode: batch.mode,
      query: batch.query,
      categories: batch.categories,
      fromDate: batch.fromDate,
      untilDate: batch.untilDate,
      totalAvailable: batch.totalAvailable,
      fetched: batch.fetched ?? batch.results.length,
    }))
  return `搜索 Agent 已完成外部学术检索。

用户原始问题：
${userText}

搜索计划：
${JSON.stringify(plan, null, 2)}

搜索质量评估：
${reflection ? JSON.stringify(reflection, null, 2) : '未执行额外评估'}

Feed 搜索元数据：
${feedContext.length > 0 ? JSON.stringify(feedContext, null, 2) : '非 feed 模式'}

搜索结果（OpenAlex + arXiv + Semantic Scholar + Crossref，已合并去重并按计划中的排序模式处理）：
${searchContext}

请基于这些真实搜索结果回答用户。要求：
- 不要编造搜索结果里没有的信息
- 如果是 arXiv feed 模式，必须说明搜索模式、分类、日期、totalAvailable/arXiv totalResults 和本次 fetched 数；不要把 fetched 当成总数
- 如果结果不够准确，要明确说明不确定性和下一步应如何精炼查询
- 优先列出最相关论文，并解释为什么匹配
- 包含标题、作者、年份、来源/期刊、引用数、链接或 DOI
- 使用简体中文和 Markdown`
}

function truncateEvidenceText(text: string, limit = 12_000): string {
  return text.length > limit ? `${text.slice(0, limit)}\n[截断：临时 evidence 文本过长]` : text
}

export function buildEvidenceSynthesisUserPrompt(
  userText: string,
  plan: SearchPlan,
  notes: PaperEvidenceNote[],
  context: {
    mode: 'search_evidence' | 'deep_research'
    reflection?: SearchReflection
  },
): string {
  const evidenceContext = notes.map((note, index) => {
    const authors = note.paper.authors.map((author) => author.name).slice(0, 4).join(', ') || '作者未知'
    return `## Paper ${index + 1}
标题：${note.paper.title}
作者：${authors}
日期：${note.paper.published_date ?? note.paper.year ?? '未知'}
来源：${note.paper.source}${note.paper.journal ? ` / ${note.paper.journal}` : ''}
DOI：${note.paper.doi ?? '无'}
来源链接：${note.paper.source_url || '无'}
证据等级：${note.evidenceLevel}
临时文本缓存命中：${note.cacheHit ? '是' : '否'}
临时 PDF 缓存命中：${note.pdfCacheHit ? '是' : '否'}
${note.warning ? `降级/警告：${note.warning}\n` : ''}
证据文本：
${truncateEvidenceText(note.text)}`
  }).join('\n\n---\n\n')

  return `研究 Agent 已完成 ${context.mode === 'deep_research' ? 'Deep Research' : '搜索后的 evidence gate'}。

用户原始问题：
${userText}

搜索/研究计划：
${JSON.stringify(plan, null, 2)}

搜索质量评估：
${context.reflection ? JSON.stringify(context.reflection, null, 2) : '未执行额外评估或复用已有搜索结果'}

每篇论文的一手/降级证据：
${evidenceContext || '没有可用论文证据。'}

请基于以上真实 evidence 回答用户。要求：
- 开头用简短列表标注每篇论文的 evidence level：PDF 临时文本 / abstract / metadata
- 如果 evidenceLevel=pdf_text_preview，说明这是临时读取开放 PDF 文本片段，没有导入文献库
- 如果 evidenceLevel=abstract_only 或 metadata_only，不要声称读过全文，也不要编造全文细节
- 对“方法、实验、结论、贡献、局限、定义、理论、对比”逐项作答
- 多篇论文时做横向综合，不要只是堆论文列表
- 不建议 Sci-Hub，不绕过付费墙
- 使用简体中文和 Markdown`
}

export function buildPaperDetailUserPrompt(
  userText: string,
  plan: SearchPlan,
  detailContext: string,
): string {
  return `用户问题：
${userText}

论文引用计划：
${JSON.stringify(plan.paperReference ?? {}, null, 2)}

论文元信息：
${detailContext}

请基于这些元信息回答。要求：
- 明确写出“证据来源：metadata / abstract”
- 如果只能基于摘要和元信息，不要说你读了全文
- 用户只问元信息时保持简洁
- 使用简体中文和 Markdown`
}

export function buildPaperPreviewUserPrompt(
  userText: string,
  plan: SearchPlan,
  previewContext: string,
): string {
  return `用户问题：
${userText}

论文引用计划：
${JSON.stringify(plan.paperReference ?? {}, null, 2)}

论文预览上下文：
${previewContext}

请回答这篇论文。固定包含：
- 证据来源
- 这篇论文主要讲什么
- 核心方法
- 主要结论
- 局限或注意事项

要求：
- 如果证据来源是 PDF 临时文本，说明“我临时读取了开放 PDF 的文本片段，但没有把它加入你的文献库”
- 如果证据来源只是 metadata/abstract，说明“我目前只能基于摘要和元信息解释，还没有读取全文”
- 不要编造上下文里没有的信息
- 不要建议 Sci-Hub 或绕过付费墙
- 使用简体中文和 Markdown`
}
