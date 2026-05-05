/**
 * [INPUT]: 依赖 services/search
 * [OUTPUT]: 对外提供 Research Harness 的学术搜索工具封装与结果格式化
 * [POS]: agent 模块的工具层，统一包装外部学术搜索能力
 */
import { formatSearchResults, searchPapers, type SearchOptions, type SearchResult } from '../services/search.ts'
import type { PaperReference, SearchBatch, SearchPlan, SearchResultSet, ToolResult } from './types'

function searchResultKey(result: SearchResult): string {
  if (result.doi) return `doi:${result.doi.toLowerCase()}`
  return `title:${result.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`
}

export function mergeSearchBatches(batches: SearchBatch[], limit: number): SearchResult[] {
  const byKey = new Map<string, SearchResult>()
  for (const result of batches.flatMap((batch) => batch.results)) {
    const key = searchResultKey(result)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { ...result, authors: [...result.authors] })
      continue
    }

    if (!existing.abstract_text) existing.abstract_text = result.abstract_text
    if (!existing.open_access_url) existing.open_access_url = result.open_access_url
    if (!existing.open_access_pdf_url) existing.open_access_pdf_url = result.open_access_pdf_url
    if (!existing.open_access_landing_url) existing.open_access_landing_url = result.open_access_landing_url
    if (!existing.journal) existing.journal = result.journal
    if (!existing.doi) existing.doi = result.doi
    if (!existing.published_date) existing.published_date = result.published_date
    existing.citation_count = Math.max(existing.citation_count, result.citation_count)
    existing.quality_score = Math.max(existing.quality_score, result.quality_score)
    existing.is_top_journal ||= result.is_top_journal
    if (!existing.source.includes(result.source)) existing.source = `${existing.source} / ${result.source}`
  }

  return Array.from(byKey.values())
    .sort((a, b) => b.quality_score - a.quality_score)
    .slice(0, limit)
}

function normalizeLookup(value: string): string {
  return value.toLowerCase().replace(/https?:\/\/doi\.org\//, '').replace(/^doi:/, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function chineseNumberToInt(value: string): number | null {
  const digits: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  }
  if (/^\d+$/.test(value)) return Number(value)
  if (value === '十') return 10
  if (value.startsWith('十')) return 10 + (digits[value[1]] ?? 0)
  if (value.endsWith('十')) return (digits[value[0]] ?? 0) * 10
  if (value.includes('十')) {
    const [tens, ones] = value.split('十')
    return (digits[tens] ?? 0) * 10 + (digits[ones] ?? 0)
  }
  return digits[value] ?? null
}

function inferReferenceFromText(userText: string): PaperReference | undefined {
  const ordinal = userText.match(/第\s*([0-9一二两三四五六七八九十]+)\s*(篇|个|条|项|篇论文|个结果|条结果)?/)
  if (ordinal) {
    const resultIndex = chineseNumberToInt(ordinal[1])
    if (resultIndex) return { resultIndex }
  }

  const doi = userText.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i)?.[0]
  if (doi) return { doi }
  return undefined
}

export interface PaperReferenceContext {
  currentPaper?: SearchResult | null
  lastSearchResults?: SearchResult[]
  activeSearchResultSetId?: string
  recentSearchResultSets?: SearchResultSet[]
}

function candidatePapers(context: PaperReferenceContext): SearchResult[] {
  const lastSearchResults = context.lastSearchResults ?? activeSearchResultSet(context)?.results ?? []
  if (!context.currentPaper) return lastSearchResults

  const currentKey = searchResultKey(context.currentPaper)
  return [
    context.currentPaper,
    ...lastSearchResults.filter((paper) => searchResultKey(paper) !== currentKey),
  ]
}

function activeSearchResultSet(context: PaperReferenceContext): SearchResultSet | undefined {
  const sets = context.recentSearchResultSets ?? []
  return sets.find((set) => set.id === context.activeSearchResultSetId) ?? sets[0]
}

export function directPdfUrl(paper: SearchResult): string | null {
  return paper.open_access_pdf_url ?? paper.open_access_url ?? null
}

export function requestedEvidencePaperCount(userText: string, plan: SearchPlan): number {
  if (plan.targetPaperCount) return Math.max(1, Math.min(5, plan.targetPaperCount))

  const explicitCount = userText.match(/([1-5一二两三四五])\s*(篇|个|条)/)
  if (explicitCount) {
    const parsed = chineseNumberToInt(explicitCount[1])
    if (parsed) return Math.max(1, Math.min(5, parsed))
  }

  if (plan.evidenceRequirement === 'single_pdf_required') return 1
  if (/几篇|多篇|这些|它们|他们|对比|比较|综合|综述|深读|deep research/i.test(userText)) return 3
  return 3
}

export function requiresPrimarySource(userText: string, plan: SearchPlan): boolean {
  if (/只\s*(推荐|列出|搜索|找)|不用\s*(详细|分析|深读|读全文)|不需要\s*(详细|分析|深读|读全文)|不要\s*(详细分析|读全文|读取PDF|读取 PDF)/i.test(userText)) {
    return false
  }

  if (plan.evidenceRequirement === 'single_pdf_required' || plan.evidenceRequirement === 'multi_pdf_required') {
    return true
  }

  if (plan.intent === 'paper_preview' || plan.intent === 'deep_research') return true
  if (plan.evidenceRequirement === 'metadata_ok' || plan.evidenceRequirement === 'abstract_ok') return false

  return /方法|实验|结果|结论|贡献|局限|限制|理论|定义|如何证明|怎么证明|怎么做|为什么重要|机制|对比|比较|综合|综述|深读|详细分析|解释.*方法|解释.*结论|method|experiment|result|conclusion|contribution|limitation|theory|definition|compare|synthesize/i.test(userText)
}

function inferResultIndicesFromText(userText: string): number[] {
  const indices = new Set<number>()
  const listMatch = userText.match(/第\s*([0-9一二两三四五六七八九十\s、，,和及与到-]+)\s*(?:篇(?:论文|文献)?|(?:条|个|项)结果)/)
  if (listMatch) {
    for (const value of listMatch[1].split(/[、，,和及与]+/)) {
      for (const parsed of parseIndexToken(value)) {
        indices.add(parsed)
      }
    }
  }

  for (const match of userText.matchAll(/第\s*([0-9一二两三四五六七八九十]+)\s*(?:篇(?:论文|文献)?|(?:条|个|项)结果)/g)) {
    const parsed = chineseNumberToInt(match[1])
    if (parsed) indices.add(parsed)
  }

  return Array.from(indices).filter((index) => index > 0)
}

function parseIndexToken(value: string): number[] {
  const token = value.trim()
  if (!token) return []

  const range = token.match(/^([0-9一二两三四五六七八九十]+)\s*(?:-|到|至)\s*([0-9一二两三四五六七八九十]+)$/)
  if (range) {
    const start = chineseNumberToInt(range[1])
    const end = chineseNumberToInt(range[2])
    if (!start || !end) return []
    const [from, to] = start <= end ? [start, end] : [end, start]
    return Array.from({ length: Math.min(20, to - from + 1) }, (_, index) => from + index)
  }

  const parsed = chineseNumberToInt(token)
  return parsed ? [parsed] : []
}

function inferLeadingCount(userText: string): number | null {
  const match = userText.match(/前\s*([0-9一二两三四五六七八九十]+)\s*(?:篇(?:论文|文献)?|(?:条|个|项)结果)/)
  if (!match) return null
  const parsed = chineseNumberToInt(match[1])
  return parsed ? Math.max(1, Math.min(20, parsed)) : null
}

function inferReferencedGroupCount(userText: string): number | null {
  const match = userText.match(/(?:刚才|上一轮|上面|你(?:刚才)?筛选|你(?:刚才)?筛出来|那|这)\s*([0-9一二两三四五六七八九十]+)\s*篇\s*(?:论文|文献|paper|papers|结果)?|([0-9一二两三四五六七八九十]+)\s*篇\s*(?:论文|文献|paper|papers|结果)/i)
  if (!match) return null
  const parsed = chineseNumberToInt(match[1] ?? match[2])
  return parsed ? Math.max(1, Math.min(20, parsed)) : null
}

export function hasStrongResultSetAnchor(userText: string): boolean {
  return /\bR\s*[0-9]+(?:\s*[-#：:]\s*[0-9一二两三四五六七八九十]+)?\b/i.test(userText)
    || /第\s*[0-9一二两三四五六七八九十]+(?:\s*(?:-|到|至)\s*[0-9一二两三四五六七八九十]+)?\s*(?:篇(?:论文|文献)?|(?:条|个|项)结果)/.test(userText)
    || /前\s*[0-9一二两三四五六七八九十]+\s*(?:篇(?:论文|文献)?|(?:条|个|项)结果)/.test(userText)
    || /(?:刚才|上一轮|上面|你(?:刚才)?筛选|你(?:刚才)?筛出来).{0,12}(?:论文|文献|paper|papers|结果|那\s*[0-9一二两三四五六七八九十]+\s*篇)/i.test(userText)
    || /(?:那|这)\s*[0-9一二两三四五六七八九十]+\s*篇\s*(?:论文|文献|paper|papers|结果)/i.test(userText)
}

export function hasExplicitCurrentPaperAnchor(userText: string): boolean {
  return /(?:这篇|这个|该|当前)\s*(?:论文|paper|文献|文章)|刚才那篇\s*(?:论文|文献|paper|文章)|this\s+paper|the\s+paper/i.test(userText)
}

export function hasWeakPronounOnly(userText: string): boolean {
  return /这些|它们|他们|那几个|这几个|这些东西|那些/.test(userText) && !hasStrongResultSetAnchor(userText)
}

export function shouldForceNewSearch(userText: string): boolean {
  return /重新搜|重新搜索|再搜|换一批|新搜|重新查|再查|最新再查|重新来一批/i.test(userText)
}

export function isResultSetLinkRequest(userText: string): boolean {
  return /(链接|地址|URL|网址|arXiv|PDF|pdf|doi|DOI|来源)/i.test(userText)
}

function findResultSetByLabel(userText: string, sets: SearchResultSet[]): SearchResultSet | undefined {
  const label = userText.match(/\bR\s*([0-9]+)\b/i)
  if (!label) return undefined
  return sets.find((set) => set.label.toLowerCase() === `r${label[1]}`)
}

function inferResultSetScopedIndices(userText: string): number[] {
  const indices = new Set<number>()
  for (const match of userText.matchAll(/\bR\s*[0-9]+\s*[-#：:]\s*([0-9一二两三四五六七八九十]+)(?:\s*(?:-|到|至)\s*R?\s*[0-9]*\s*[-#：:]?\s*([0-9一二两三四五六七八九十]+))?/gi)) {
    const token = match[2] ? `${match[1]}-${match[2]}` : match[1]
    for (const parsed of parseIndexToken(token)) {
      indices.add(parsed)
    }
  }
  return Array.from(indices).filter((index) => index > 0)
}

export interface ResultSetReferenceResolution {
  resultSet: SearchResultSet
  papers: SearchResult[]
  indices: number[]
  referencedExisting: boolean
}

export function resolveResultSetReference(
  userText: string,
  context: PaperReferenceContext = {},
  fallbackLimit = 5,
): ToolResult<ResultSetReferenceResolution> {
  const sets = context.recentSearchResultSets ?? []
  if (sets.length === 0) return { ok: false, error: '没有可引用的搜索结果集。请先搜索论文。' }

  const resultSet = findResultSetByLabel(userText, sets) ?? activeSearchResultSet(context)
  if (!resultSet) return { ok: false, error: '没有可引用的当前搜索结果集。' }

  const strongAnchor = hasStrongResultSetAnchor(userText)
  if (!strongAnchor) {
    return { ok: false, error: '用户没有明确引用已有搜索结果集。' }
  }

  const explicitIndices = [...new Set([...inferResultSetScopedIndices(userText), ...inferResultIndicesFromText(userText)])]
  const leadingCount = inferLeadingCount(userText)
  const groupCount = inferReferencedGroupCount(userText)

  const indices = explicitIndices.length > 0
    ? explicitIndices
    : Array.from({ length: leadingCount ?? groupCount ?? Math.min(fallbackLimit, resultSet.results.length) }, (_, index) => index + 1)
  const papers = indices
    .map((index) => resultSet.results[index - 1])
    .filter((paper): paper is SearchResult => Boolean(paper))

  if (papers.length === 0) {
    return { ok: false, error: `${resultSet.label} 中没有这些序号对应的论文。` }
  }

  return {
    ok: true,
    data: {
      resultSet,
      papers,
      indices: indices.slice(0, papers.length),
      referencedExisting: true,
    },
  }
}

export function resolvePaperReferences(
  plan: SearchPlan,
  userText: string,
  context: PaperReferenceContext = {},
  fallbackLimit = 3,
): ToolResult<SearchResult[]> {
  const resultSetRef = resolveResultSetReference(userText, context, fallbackLimit)
  if (resultSetRef.ok && resultSetRef.data) return { ok: true, data: resultSetRef.data.papers }

  const lastSearchResults = context.lastSearchResults ?? activeSearchResultSet(context)?.results ?? []
  const indices = inferResultIndicesFromText(userText)
  const hasPaperSetSemantics = /这些\s*(?:论文|文献|paper|papers)|这几篇\s*(?:论文|文献|paper|papers)|刚才那几篇\s*(?:论文|文献|paper|papers)|the papers|these papers/i.test(userText)

  if (hasStrongResultSetAnchor(userText) && indices.length > 0) {
    const papers = indices
      .map((index) => lastSearchResults[index - 1])
      .filter((paper): paper is SearchResult => Boolean(paper))
    if (papers.length > 0) return { ok: true, data: papers.slice(0, fallbackLimit) }
    return { ok: false, error: `最近搜索结果中没有 ${indices.map((index) => `第 ${index} 篇`).join('、')}。` }
  }

  if (plan.paperReference) {
    const resolved = resolvePaperReference(plan, userText, context)
    return resolved.ok && resolved.data
      ? { ok: true, data: [resolved.data] }
      : { ok: false, error: resolved.error }
  }

  if (hasPaperSetSemantics && context.currentPaper) {
    const currentPaper = context.currentPaper
    const papers = [currentPaper, ...lastSearchResults.filter((paper) => searchResultKey(paper) !== searchResultKey(currentPaper))]
    return { ok: true, data: papers.slice(0, fallbackLimit) }
  }

  if (hasPaperSetSemantics && lastSearchResults.length > 0) return { ok: true, data: lastSearchResults.slice(0, fallbackLimit) }
  return { ok: false, error: '没有可用于深度研究的搜索结果。请先搜索论文，或提供论文标题/DOI。' }
}

export function selectEvidencePapers(results: SearchResult[], limit: number): SearchResult[] {
  const byKey = new Map<string, SearchResult>()
  for (const paper of results) {
    const key = searchResultKey(paper)
    if (!byKey.has(key)) byKey.set(key, paper)
  }

  const unique = Array.from(byKey.values())
  const withPdf = unique.filter((paper) => Boolean(directPdfUrl(paper)))
  const withoutPdf = unique.filter((paper) => !directPdfUrl(paper))
  return [...withPdf, ...withoutPdf].slice(0, Math.max(1, Math.min(5, limit)))
}

export function resolvePaperReference(
  plan: SearchPlan,
  userText: string,
  context: PaperReferenceContext = {},
): ToolResult<SearchResult> {
  const lastSearchResults = context.lastSearchResults ?? activeSearchResultSet(context)?.results ?? []
  const candidates = candidatePapers(context)

  if (candidates.length === 0) {
    return { ok: false, error: '没有可引用的最近搜索结果。请先搜索论文，或提供论文标题/DOI。' }
  }

  const resultSetRef = resolveResultSetReference(userText, context, 1)
  if (resultSetRef.ok && resultSetRef.data?.papers[0]) {
    return { ok: true, data: resultSetRef.data.papers[0] }
  }

  const reference = plan.paperReference ?? inferReferenceFromText(userText)
  if (reference?.resultIndex) {
    const result = lastSearchResults[reference.resultIndex - 1]
    return result
      ? { ok: true, data: result }
      : { ok: false, error: `最近搜索结果中没有第 ${reference.resultIndex} 篇。` }
  }

  if (reference?.doi) {
    const wanted = normalizeLookup(reference.doi)
    const result = candidates.find((paper) => paper.doi && normalizeLookup(paper.doi) === wanted)
    if (result) return { ok: true, data: result }
  }

  if (reference?.sourceUrl) {
    const result = candidates.find((paper) => paper.source_url === reference.sourceUrl)
    if (result) return { ok: true, data: result }
  }

  if (reference?.openAccessUrl) {
    const result = candidates.find((paper) => (
      paper.open_access_url === reference.openAccessUrl
      || paper.open_access_pdf_url === reference.openAccessUrl
      || paper.open_access_landing_url === reference.openAccessUrl
    ))
    if (result) return { ok: true, data: result }
  }

  if (reference?.title) {
    const wanted = normalizeLookup(reference.title)
    const result = candidates.find((paper) => {
      const title = normalizeLookup(paper.title)
      return title === wanted || title.includes(wanted) || wanted.includes(title)
    })
    if (result) return { ok: true, data: result }
  }

  if (hasExplicitCurrentPaperAnchor(userText)) {
    if (context.currentPaper) return { ok: true, data: context.currentPaper }
    if (lastSearchResults.length === 1) return { ok: true, data: lastSearchResults[0] }
  }

  if (lastSearchResults.length === 1 && (plan.paperReference || hasExplicitCurrentPaperAnchor(userText))) {
    return { ok: true, data: lastSearchResults[0] }
  }

  return {
    ok: false,
    error: lastSearchResults.length > 1
      ? '我还不能确定你指的是哪一篇。请用“第 N 篇”或标题/DOI 指明。'
      : '我还不能确定你指的是哪一篇。请给出标题/DOI，或先搜索论文。',
  }
}

function searchOptionsFromPlan(plan: SearchPlan): SearchOptions {
  return {
    fromDate: plan.timeRange?.fromDate,
    untilDate: plan.timeRange?.untilDate,
    sortMode: plan.sortMode,
    searchMode: plan.searchMode,
    sourceHint: plan.sourceHint,
    categoryPreset: plan.categoryPreset,
    arxivCategories: plan.arxivCategories,
    feedLimit: plan.feedLimit,
    includeTotalCount: plan.includeTotalCount,
  }
}

export async function academicSearchTool(
  query: string,
  options: SearchOptions,
  limit = 10,
  signal?: AbortSignal,
): Promise<ToolResult<SearchBatch>> {
  try {
    const response = await searchPapers(query, limit, options, signal)
    return {
      ok: true,
      data: {
        query,
        total: response.total,
        results: response.results,
        mode: response.mode,
        totalAvailable: response.totalAvailable,
        fetched: response.fetched,
        categories: response.categories,
        fromDate: response.fromDate,
        untilDate: response.untilDate,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function runAcademicSearches(
  plan: SearchPlan,
  signal?: AbortSignal,
): Promise<ToolResult<SearchBatch[]>> {
  const batches: SearchBatch[] = []
  const options = searchOptionsFromPlan(plan)
  const isFeedMode = plan.searchMode === 'recent_ai_feed' || plan.searchMode === 'arxiv_category_feed'
  const queries = isFeedMode ? [plan.queries[0] ?? 'arXiv category feed'] : plan.queries
  const limit = isFeedMode ? (plan.feedLimit ?? 50) : 10
  for (const query of queries) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const result = await academicSearchTool(query, options, limit, signal)
    if (!result.ok || !result.data) {
      return { ok: false, error: result.error ?? `搜索失败：${query}` }
    }
    batches.push(result.data)
  }

  return { ok: true, data: batches }
}

export function formatSearchBatches(batches: SearchBatch[], limit = 12): string {
  const merged = mergeSearchBatches(batches, limit)
  if (merged.length === 0) return '未找到相关论文。'
  const queryList = batches.map((batch) => {
    const feed = batch.mode === 'recent_ai_feed' || batch.mode === 'arxiv_category_feed'
      ? `；模式 ${batch.mode}；分类 ${(batch.categories ?? []).join(', ') || '未知'}；日期 ${batch.fromDate ?? '?'} 至 ${batch.untilDate ?? '?'}；totalAvailable ${batch.totalAvailable ?? '未知'}；fetched ${batch.fetched ?? batch.results.length}`
      : ''
    return `- ${batch.query}（返回 ${batch.total} 条${feed}）`
  }).join('\n')
  return `执行过的查询：\n${queryList}\n\n合并去重后的结果：\n\n${formatSearchResults(merged)}`
}
