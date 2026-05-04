/**
 * [INPUT]: 依赖 services/ai 与 agent/prompts
 * [OUTPUT]: 对外提供意图规划、JSON 解析和 planner 归一化逻辑
 * [POS]: agent 模块的 guide 层，负责把用户输入转成受控 SearchPlan
 */
import { chatWithAgentModel, type ChatMessage } from '../services/ai'
import { buildPlannerUserPrompt, PLANNER_SYSTEM_PROMPT } from './prompts'
import type {
  CategoryPreset,
  EvidenceRequirement,
  PaperReference,
  RecencyIntent,
  ResearchIntent,
  RunResearchHarnessInput,
  SearchMode,
  SearchPlan,
  SearchSortMode,
  SearchSourceHint,
} from './types'

export const DEFAULT_PLAN: SearchPlan = {
  intent: 'answer',
  shouldSearch: false,
  queries: [],
  recencyIntent: 'none',
  sortMode: 'relevance',
}

const ARXIV_CATEGORY_PRESETS: Record<Exclude<CategoryPreset, 'custom'>, string[]> = {
  ai: ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV', 'cs.RO', 'stat.ML'],
  llm: ['cs.CL', 'cs.AI', 'cs.LG'],
  vision: ['cs.CV', 'eess.IV', 'cs.LG'],
  robotics: ['cs.RO', 'cs.AI', 'cs.LG'],
}

function directAnswerPlan(response: string, reason: string): SearchPlan {
  return {
    intent: 'answer',
    shouldSearch: false,
    queries: [],
    response,
    reason,
    recencyIntent: 'none',
    sortMode: 'relevance',
  }
}

function isSearchResultFollowup(text: string): boolean {
  return /^(结果呢|搜到了吗|搜索结果呢|查到了吗|怎么样了|情况怎么样|有结果了吗|结果出来了吗)[？?。!！\s]*$/i.test(text)
}

function isExternalPaperSearchRequest(text: string): boolean {
  return looksLikeExternalSearchRequest(text)
}

function previousExternalSearchRequest(input: RunResearchHarnessInput): string | null {
  const messages = input.recentMessages ?? []
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role === 'user' && isExternalPaperSearchRequest(message.content)) {
      return message.content
    }
  }
  return null
}

function tryDeterministicPlan(input: RunResearchHarnessInput): SearchPlan | null {
  const text = input.userText.trim()
  const year = input.context.currentDate.slice(0, 4)

  if (/^(今年|现在).*(哪一年|几年|年份)|^(what year is it|current year)/i.test(text)) {
    return directAnswerPlan(`今年是 ${year} 年。`, 'deterministic_current_year')
  }

  if (/^(今天|现在).*(几号|日期)|^(what date is it|today'?s date)/i.test(text)) {
    return directAnswerPlan(`今天是 ${input.context.currentDate}。`, 'deterministic_current_date')
  }

  if (isSearchResultFollowup(text)) {
    const previous = previousExternalSearchRequest(input)
    if (previous) {
      const plan = deterministicExternalSearchPlan(
        { ...input, userText: previous },
        { ...DEFAULT_PLAN, reason: 'deterministic_pending_search_followup' },
      )
      if (plan) return plan
    }
  }

  const externalSearchPlan = deterministicExternalSearchPlan(input, { ...DEFAULT_PLAN, reason: 'deterministic_external_search' })
  if (externalSearchPlan) return externalSearchPlan

  return null
}

export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1] ?? text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型没有返回 JSON 对象')
  return JSON.parse(candidate.slice(start, end + 1))
}

export function normalizePlan(value: unknown): SearchPlan {
  if (!value || typeof value !== 'object') return DEFAULT_PLAN
  const raw = value as Partial<SearchPlan>
  const allowed: ResearchIntent[] = [
    'academic_search',
    'paper_detail',
    'paper_preview',
    'deep_research',
    'import_to_library',
    'local_research',
    'answer',
    'feedback',
    'clarify',
  ]
  const intent = raw.intent && allowed.includes(raw.intent) ? raw.intent : 'answer'
  const queries = Array.isArray(raw.queries)
    ? raw.queries
        .filter((query): query is string => typeof query === 'string')
        .map((query) => query.trim())
        .filter(Boolean)
        .slice(0, 3)
    : []
  const recencyValues: RecencyIntent[] = ['none', 'latest', 'this_week', 'recent_days', 'this_year', 'custom_range']
  const sortValues: SearchSortMode[] = ['relevance', 'newest', 'balanced']
  const evidenceValues: EvidenceRequirement[] = ['metadata_ok', 'abstract_ok', 'single_pdf_required', 'multi_pdf_required']
  const modeValues: SearchMode[] = ['keyword_search', 'paper_lookup', 'recent_ai_feed', 'arxiv_category_feed']
  const sourceValues: SearchSourceHint[] = ['all', 'arxiv', 'openalex', 'semantic_scholar', 'crossref']
  const presetValues: CategoryPreset[] = ['ai', 'llm', 'vision', 'robotics', 'custom']
  const searchMode = raw.searchMode && modeValues.includes(raw.searchMode) ? raw.searchMode : undefined
  const isFeedMode = searchMode === 'recent_ai_feed' || searchMode === 'arxiv_category_feed'
  const normalizedQueries = queries.length > 0
    ? queries
    : isFeedMode
      ? ['arXiv category feed']
      : []
  const target = raw.target === 'resolved_result_set_items' ? raw.target : 'none'
  const targetPaperCount = typeof raw.targetPaperCount === 'number' && Number.isFinite(raw.targetPaperCount)
    ? Math.max(1, Math.min(5, Math.round(raw.targetPaperCount)))
    : undefined
  const feedLimit = typeof raw.feedLimit === 'number' && Number.isFinite(raw.feedLimit)
    ? Math.max(1, Math.min(200, Math.round(raw.feedLimit)))
    : undefined
  const arxivCategories = Array.isArray(raw.arxivCategories)
    ? raw.arxivCategories
        .filter((category): category is string => typeof category === 'string')
        .map((category) => category.trim())
        .filter((category) => /^[a-z-]+\.[A-Z]{2}$/i.test(category))
        .slice(0, 12)
    : undefined
  const timeRange = raw.timeRange && typeof raw.timeRange === 'object'
    ? {
        fromDate: typeof raw.timeRange.fromDate === 'string' ? raw.timeRange.fromDate : undefined,
        untilDate: typeof raw.timeRange.untilDate === 'string' ? raw.timeRange.untilDate : undefined,
      }
    : undefined
  const localPaperRequest = raw.localPaperRequest && typeof raw.localPaperRequest === 'object'
    ? {
        target: raw.localPaperRequest.target,
        query: typeof raw.localPaperRequest.query === 'string' ? raw.localPaperRequest.query : undefined,
      }
    : undefined
  const paperReference = normalizePaperReference(raw.paperReference)

  return {
    intent,
    shouldSearch: Boolean(raw.shouldSearch) && (normalizedQueries.length > 0 || isFeedMode),
    queries: normalizedQueries,
    target,
    evidenceRequirement: raw.evidenceRequirement && evidenceValues.includes(raw.evidenceRequirement)
      ? raw.evidenceRequirement
      : undefined,
    targetPaperCount,
    searchMode,
    sourceHint: raw.sourceHint && sourceValues.includes(raw.sourceHint) ? raw.sourceHint : undefined,
    categoryPreset: raw.categoryPreset && presetValues.includes(raw.categoryPreset) ? raw.categoryPreset : undefined,
    arxivCategories,
    feedLimit,
    includeTotalCount: typeof raw.includeTotalCount === 'boolean' ? raw.includeTotalCount : undefined,
    response: typeof raw.response === 'string' ? raw.response.trim() : undefined,
    reason: typeof raw.reason === 'string' ? raw.reason.trim() : undefined,
    localPaperRequest,
    paperReference,
    recencyIntent: raw.recencyIntent && recencyValues.includes(raw.recencyIntent) ? raw.recencyIntent : 'none',
    timeRange,
    sortMode: raw.sortMode && sortValues.includes(raw.sortMode) ? raw.sortMode : 'relevance',
  }
}

function addDays(isoDate: string, delta: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

function inferFromChineseMonthDay(text: string, currentDate: string): string | undefined {
  const match = text.match(/([0-9]{1,2})\s*月\s*([0-9]{1,2})\s*日?\s*(以来|之后|起|开始)?/)
  if (!match) return undefined
  const year = currentDate.slice(0, 4)
  const month = match[1].padStart(2, '0')
  const day = match[2].padStart(2, '0')
  return `${year}-${month}-${day}`
}

function inferArxivCategories(text: string): { preset: CategoryPreset; categories: string[] } | null {
  const explicit = Array.from(text.matchAll(/\b(?:cs|stat|eess|math|q-bio|physics)\.[A-Z]{2}\b/g))
    .map((match) => match[0])
  if (explicit.length > 0) return { preset: 'custom', categories: Array.from(new Set(explicit)) }
  if (/LLM|大语言模型|language model|语言模型/i.test(text)) return { preset: 'llm', categories: ARXIV_CATEGORY_PRESETS.llm }
  if (/vision|视觉|图像|视频|多模态|multimodal/i.test(text)) return { preset: 'vision', categories: ARXIV_CATEGORY_PRESETS.vision }
  if (/robot|机器人|robotics/i.test(text)) return { preset: 'robotics', categories: ARXIV_CATEGORY_PRESETS.robotics }
  if (/AI|人工智能|机器学习|深度学习|arXiv/i.test(text)) return { preset: 'ai', categories: ARXIV_CATEGORY_PRESETS.ai }
  return null
}

export function looksLikeExternalSearchRequest(text: string): boolean {
  return /(?:搜索|搜|找|检索|查|search|find|lookup).{0,16}(?:论文|文献|paper|papers|article|articles)|(?:最新|最近|近期|今天|昨日|昨天|本周|这周|上周|以来|之后|新论文|latest|recent).{0,24}(?:论文|文献|paper|papers|AI|人工智能|机器学习|LLM|大语言模型|arXiv)|(?:arXiv|OpenAlex|Semantic Scholar|Crossref).{0,24}(?:论文|文献|paper|papers|搜索|检索|找)/i.test(text)
}

function inferRecentFromDate(text: string, currentDate: string, plan: SearchPlan): string {
  const explicit = inferFromChineseMonthDay(text, currentDate)
  if (explicit) return explicit

  const days = text.match(/最近\s*([0-9一二两三四五六七八九十]+)\s*天/)
  if (days) {
    const parsed = Number(days[1]) || ({ 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 } as Record<string, number>)[days[1]] || 7
    return addDays(currentDate, -Math.max(1, Math.min(30, parsed)))
  }

  if (/今天|今日|today/i.test(text)) return currentDate
  if (/昨天|昨日|yesterday/i.test(text)) return addDays(currentDate, -1)
  if (/上周|最近|近期|recent/i.test(text)) return addDays(currentDate, -7)
  if (/本周|这周/i.test(text)) return addDays(currentDate, -6)
  return plan.timeRange?.fromDate ?? addDays(currentDate, -7)
}

export function deterministicExternalSearchPlan(
  input: RunResearchHarnessInput,
  base: SearchPlan = DEFAULT_PLAN,
): SearchPlan | null {
  const text = input.userText
  if (!looksLikeExternalSearchRequest(text)) return null

  if (/只\s*推荐|推荐\s*[0-9一二两三四五六七八九十]+\s*篇/.test(text) && !/一共有多少|多少篇|总数|feed|以来|之后|最新|最近|上周|今天/i.test(text)) {
    return {
      ...base,
      intent: 'academic_search',
      shouldSearch: true,
      queries: base.queries.length > 0 ? base.queries : [text],
      searchMode: base.searchMode && base.searchMode !== 'recent_ai_feed' && base.searchMode !== 'arxiv_category_feed'
        ? base.searchMode
        : 'keyword_search',
      sourceHint: base.sourceHint ?? 'all',
      sortMode: base.sortMode ?? 'balanced',
    }
  }

  const asksRecentFeed = /(今天|今日|昨天|昨日|最近|近期|本周|这周|上周|以来|之后|新论文|最新|一共有多少|多少篇|feed|arXiv).*?(AI|人工智能|机器学习|LLM|大语言模型|cs\.[A-Z]{2}|arXiv)|(?:AI|人工智能|机器学习|LLM|大语言模型|cs\.[A-Z]{2}|arXiv).*?(今天|今日|昨天|昨日|最近|近期|本周|这周|上周|以来|之后|新论文|最新|一共有多少|多少篇|feed)/i.test(text)
  const categoryInfo = inferArxivCategories(text)
  if (!asksRecentFeed || !categoryInfo) {
    return {
      ...base,
      intent: 'academic_search',
      shouldSearch: true,
      queries: base.queries.length > 0 ? base.queries : [text],
      searchMode: base.searchMode && base.searchMode !== 'recent_ai_feed' && base.searchMode !== 'arxiv_category_feed'
        ? base.searchMode
        : 'keyword_search',
      sourceHint: base.sourceHint ?? 'all',
      sortMode: base.sortMode === 'relevance' ? 'balanced' : base.sortMode ?? 'balanced',
      evidenceRequirement: base.evidenceRequirement ?? 'abstract_ok',
    }
  }

  const fromDate = inferRecentFromDate(text, input.context.currentDate, base)
  const untilDate = /昨天|昨日|yesterday/i.test(text) ? fromDate : base.timeRange?.untilDate ?? input.context.currentDate
  const includeTotalCount = /一共有多少|多少篇|总数|total/i.test(text) || base.includeTotalCount

  return {
    ...base,
    intent: 'academic_search',
    shouldSearch: true,
    queries: base.queries.length > 0 ? base.queries : [`arXiv ${categoryInfo.preset} recent feed`],
    searchMode: categoryInfo.preset === 'custom' ? 'arxiv_category_feed' : 'recent_ai_feed',
    sourceHint: 'arxiv',
    categoryPreset: categoryInfo.preset,
    arxivCategories: categoryInfo.categories,
    timeRange: { fromDate, untilDate },
    sortMode: 'newest',
    feedLimit: base.feedLimit ?? (includeTotalCount ? 100 : 50),
    includeTotalCount,
  }
}

function enrichPlanWithSearchMode(input: RunResearchHarnessInput, plan: SearchPlan): SearchPlan {
  const forcedPlan = deterministicExternalSearchPlan(input, plan)
  if (forcedPlan) return forcedPlan
  return plan
}

function normalizePaperReference(value: unknown): PaperReference | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const numericIndex = typeof raw.resultIndex === 'number'
    ? raw.resultIndex
    : typeof raw.resultIndex === 'string'
      ? Number(raw.resultIndex)
      : undefined
  const resultIndex = typeof numericIndex === 'number' && Number.isInteger(numericIndex) && numericIndex > 0
    ? numericIndex
    : undefined
  const ref: PaperReference = {
    resultIndex,
    title: typeof raw.title === 'string' ? raw.title.trim() || undefined : undefined,
    doi: typeof raw.doi === 'string' ? raw.doi.trim() || undefined : undefined,
    sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl.trim() || undefined : undefined,
    openAccessUrl: typeof raw.openAccessUrl === 'string' ? raw.openAccessUrl.trim() || undefined : undefined,
  }
  return Object.values(ref).some(Boolean) ? ref : undefined
}

export function buildPlannerRecentMessages(
  messages: ChatMessage[],
  options: { maxChars?: number; perMessageMaxChars?: number } = {},
): string {
  const maxChars = options.maxChars ?? 40_000
  const perMessageMaxChars = options.perMessageMaxChars ?? 2_000
  const selected: string[] = []
  let used = 0

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    const normalized = message.content.replace(/\s+/g, ' ')
    const text = normalized.length > perMessageMaxChars
      ? `${normalized.slice(0, perMessageMaxChars)}...`
      : normalized
    const line = `${message.role}: ${text}`
    if (used + line.length > maxChars && selected.length > 0) break
    selected.push(line)
    used += line.length
  }

  return selected.reverse().join('\n')
}

export function compactRecentMessages(messages: ChatMessage[]): string {
  return buildPlannerRecentMessages(messages)
}

export async function planResearchAction(input: RunResearchHarnessInput): Promise<SearchPlan> {
  const deterministic = tryDeterministicPlan(input)
  if (deterministic) return deterministic

  const plannerMessages: ChatMessage[] = [
    { role: 'system', content: PLANNER_SYSTEM_PROMPT },
    {
      role: 'user',
      content: buildPlannerUserPrompt(
        input.context,
        compactRecentMessages(input.recentMessages),
        input.userText,
      ),
    },
  ]

  const reply = await chatWithAgentModel(plannerMessages, 'planner', input.signal)
  try {
    return enrichPlanWithSearchMode(input, normalizePlan(extractJsonObject(reply)))
  } catch {
    return enrichPlanWithSearchMode(input, DEFAULT_PLAN)
  }
}
