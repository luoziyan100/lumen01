/**
 * [INPUT]: 依赖 services/ai 与 services/search
 * [OUTPUT]: 对外提供 runResearchAgent
 * [POS]: services 层的深度研究编排器，负责理解意图、规划学术搜索、评估结果并生成回答
 */
import { chatWithAI, type ChatMessage } from './ai'
import { formatSearchResults, searchPapers, type SearchResult } from './search'

type ResearchIntent = 'academic_search' | 'local_research' | 'answer' | 'feedback' | 'clarify'

interface SearchPlan {
  intent: ResearchIntent
  shouldSearch: boolean
  queries: string[]
  response?: string
  reason?: string
}

interface SearchReflection {
  status: 'sufficient' | 'retry' | 'not_found'
  revisedQueries: string[]
  reason?: string
}

interface SearchBatch {
  query: string
  total: number
  results: SearchResult[]
}

export interface ResearchAgentResult {
  reply: string
  searched: boolean
  plan: SearchPlan
  reflection?: SearchReflection
}

interface RunResearchAgentInput {
  userText: string
  history: ChatMessage[]
  recentMessages: ChatMessage[]
  signal?: AbortSignal
}

const DEFAULT_PLAN: SearchPlan = {
  intent: 'answer',
  shouldSearch: false,
  queries: [],
}

function isMissingAiConfigError(error: unknown): boolean {
  return String(error).includes('请先在设置中配置 AI API Key')
}

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1] ?? text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型没有返回 JSON 对象')
  return JSON.parse(candidate.slice(start, end + 1))
}

function normalizePlan(value: unknown): SearchPlan {
  if (!value || typeof value !== 'object') return DEFAULT_PLAN
  const raw = value as Partial<SearchPlan>
  const allowed: ResearchIntent[] = ['academic_search', 'local_research', 'answer', 'feedback', 'clarify']
  const intent = raw.intent && allowed.includes(raw.intent) ? raw.intent : 'answer'
  const queries = Array.isArray(raw.queries)
    ? raw.queries
        .filter((query): query is string => typeof query === 'string')
        .map((query) => query.trim())
        .filter(Boolean)
        .slice(0, 3)
    : []

  return {
    intent,
    shouldSearch: Boolean(raw.shouldSearch) && queries.length > 0,
    queries,
    response: typeof raw.response === 'string' ? raw.response.trim() : undefined,
    reason: typeof raw.reason === 'string' ? raw.reason.trim() : undefined,
  }
}

function normalizeReflection(value: unknown): SearchReflection {
  if (!value || typeof value !== 'object') {
    return { status: 'sufficient', revisedQueries: [] }
  }
  const raw = value as Partial<SearchReflection>
  const status = raw.status === 'retry' || raw.status === 'not_found' ? raw.status : 'sufficient'
  const revisedQueries = Array.isArray(raw.revisedQueries)
    ? raw.revisedQueries
        .filter((query): query is string => typeof query === 'string')
        .map((query) => query.trim())
        .filter(Boolean)
        .slice(0, 2)
    : []

  return {
    status,
    revisedQueries,
    reason: typeof raw.reason === 'string' ? raw.reason.trim() : undefined,
  }
}

function compactRecentMessages(messages: ChatMessage[]): string {
  return messages.slice(-6).map((message) => {
    const text = message.content.replace(/\s+/g, ' ').slice(0, 600)
    return `${message.role}: ${text}`
  }).join('\n')
}

async function planResearchAction(input: RunResearchAgentInput): Promise<SearchPlan> {
  const plannerMessages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是 Lumen 的学术搜索 Agent 规划器。你只负责决定下一步动作，不直接回答长篇内容。

返回严格 JSON，不要 Markdown，不要解释。Schema:
{
  "intent": "academic_search" | "local_research" | "answer" | "feedback" | "clarify",
  "shouldSearch": boolean,
  "queries": string[],
  "response": string,
  "reason": string
}

决策规则：
- 只有当用户确实要找外部论文、验证某篇论文、推荐文献、补充研究材料，或当前文献库不足以回答时，才设置 shouldSearch=true。
- 如果用户是在评价上一轮搜索质量、纠错、追问为什么不准确、或要求调整策略，这是 feedback，不要搜索。
- 如果需要搜索，把用户意图改写成 1-3 条英文 scholarly query；优先保留论文标题、作者、年份、领域术语、DOI/arXiv ID。
- 如果问题含糊但需要更多信息，intent=clarify，并在 response 中提出一个简短澄清问题。
- response 只在 feedback 或 clarify 时填写；其他情况可以为空。`,
    },
    {
      role: 'user',
      content: `最近对话：
${compactRecentMessages(input.recentMessages) || '（无）'}

当前用户输入：
${input.userText}`,
    },
  ]

  const reply = await chatWithAI(plannerMessages, undefined, input.signal)
  try {
    return normalizePlan(extractJsonObject(reply))
  } catch {
    return DEFAULT_PLAN
  }
}

function resultKey(result: SearchResult): string {
  if (result.doi) return `doi:${result.doi.toLowerCase()}`
  return `title:${result.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`
}

function mergeResults(batches: SearchBatch[], limit: number): SearchResult[] {
  const byKey = new Map<string, SearchResult>()
  for (const result of batches.flatMap((batch) => batch.results)) {
    const key = resultKey(result)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { ...result, authors: [...result.authors] })
      continue
    }

    if (!existing.abstract_text) existing.abstract_text = result.abstract_text
    if (!existing.open_access_url) existing.open_access_url = result.open_access_url
    if (!existing.journal) existing.journal = result.journal
    if (!existing.doi) existing.doi = result.doi
    existing.citation_count = Math.max(existing.citation_count, result.citation_count)
    existing.quality_score = Math.max(existing.quality_score, result.quality_score)
    existing.is_top_journal ||= result.is_top_journal
    if (!existing.source.includes(result.source)) existing.source = `${existing.source} / ${result.source}`
  }

  return Array.from(byKey.values())
    .sort((a, b) => b.quality_score - a.quality_score)
    .slice(0, limit)
}

async function runSearches(queries: string[], signal?: AbortSignal): Promise<SearchBatch[]> {
  const batches: SearchBatch[] = []
  for (const query of queries) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const response = await searchPapers(query, 10)
    batches.push({ query, total: response.total, results: response.results })
  }
  return batches
}

function formatSearchBatches(batches: SearchBatch[], limit = 12): string {
  const merged = mergeResults(batches, limit)
  if (merged.length === 0) return '未找到相关论文。'
  const queryList = batches.map((batch) => `- ${batch.query}（返回 ${batch.total} 条）`).join('\n')
  return `执行过的查询：\n${queryList}\n\n合并去重后的结果：\n\n${formatSearchResults(merged)}`
}

async function reflectOnSearchResults(
  userText: string,
  plan: SearchPlan,
  batches: SearchBatch[],
  signal?: AbortSignal,
): Promise<SearchReflection> {
  const reflectionMessages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是学术搜索结果评估器。判断当前搜索结果是否足以回答用户问题。

返回严格 JSON，不要 Markdown。Schema:
{
  "status": "sufficient" | "retry" | "not_found",
  "revisedQueries": string[],
  "reason": string
}

如果结果明显跑题，给出 1-2 条更精准的英文 revisedQueries。只允许重试一次，因此 revisedQueries 要尽量高质量。`,
    },
    {
      role: 'user',
      content: `用户问题：
${userText}

原搜索计划：
${JSON.stringify(plan, null, 2)}

搜索结果：
${formatSearchBatches(batches, 8)}`,
    },
  ]

  const reply = await chatWithAI(reflectionMessages, undefined, signal)
  try {
    return normalizeReflection(extractJsonObject(reply))
  } catch {
    return { status: 'sufficient', revisedQueries: [] }
  }
}

async function synthesizeAnswer(
  input: RunResearchAgentInput,
  plan: SearchPlan,
  batches: SearchBatch[],
  reflection?: SearchReflection,
): Promise<string> {
  const mergedResults = mergeResults(batches, 12)
  const searchContext = formatSearchResults(mergedResults)
  const synthesisMessages: ChatMessage[] = [
    ...input.history,
    {
      role: 'user',
      content: `搜索 Agent 已完成外部学术检索。

用户原始问题：
${input.userText}

搜索计划：
${JSON.stringify(plan, null, 2)}

搜索质量评估：
${reflection ? JSON.stringify(reflection, null, 2) : '未执行额外评估'}

搜索结果（OpenAlex + arXiv + Semantic Scholar + Crossref，已合并去重并按相关性/来源质量排序）：
${searchContext}

请基于这些真实搜索结果回答用户。要求：
- 不要编造搜索结果里没有的信息
- 如果结果不够准确，要明确说明不确定性和下一步应如何精炼查询
- 优先列出最相关论文，并解释为什么匹配
- 包含标题、作者、年份、来源/期刊、引用数、链接或 DOI
- 使用简体中文和 Markdown`,
    },
  ]

  return chatWithAI(synthesisMessages, undefined, input.signal)
}

export async function runResearchAgent(input: RunResearchAgentInput): Promise<ResearchAgentResult> {
  let plan: SearchPlan
  try {
    plan = await planResearchAction(input)
  } catch (error) {
    if (isMissingAiConfigError(error)) {
      return {
        reply: '搜索 Agent 需要先连接一个 AI 模型，才能理解你的意图、改写检索 query、判断结果是否相关。请先在设置里配置 API Key；配置后它不会再把“搜索结果不准确”这类反馈当作关键词去搜。',
        searched: false,
        plan: {
          intent: 'clarify',
          shouldSearch: false,
          queries: [],
          reason: 'missing_ai_config',
        },
      }
    }
    throw error
  }

  if (plan.intent === 'feedback') {
    return {
      reply: plan.response || '收到，这属于对上一轮搜索质量的反馈。我会调整查询规划和结果评估，不会把这句话本身当成检索关键词。',
      searched: false,
      plan,
    }
  }

  if (plan.intent === 'clarify') {
    return {
      reply: plan.response || '你想让我优先搜索哪一类论文或哪个具体主题？',
      searched: false,
      plan,
    }
  }

  if (!plan.shouldSearch) {
    return {
      reply: await chatWithAI(input.history, undefined, input.signal),
      searched: false,
      plan,
    }
  }

  let batches = await runSearches(plan.queries, input.signal)
  let reflection = await reflectOnSearchResults(input.userText, plan, batches, input.signal)

  if (reflection.status === 'retry' && reflection.revisedQueries.length > 0) {
    const retryBatches = await runSearches(reflection.revisedQueries, input.signal)
    batches = [...batches, ...retryBatches]
    reflection = {
      ...reflection,
      status: retryBatches.some((batch) => batch.results.length > 0) ? 'sufficient' : 'not_found',
    }
  }

  return {
    reply: await synthesizeAnswer(input, plan, batches, reflection),
    searched: true,
    plan,
    reflection,
  }
}
