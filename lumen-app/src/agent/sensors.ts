/**
 * [INPUT]: 依赖 services/ai、agent/prompts、agent/tools
 * [OUTPUT]: 对外提供搜索反思和回答风险检测
 * [POS]: agent 模块的 sensor 层，负责评估工具结果与最终输出质量风险
 */
import { chatWithAgentModel, type ChatMessage } from '../services/ai'
import { buildReflectionUserPrompt, REFLECTION_SYSTEM_PROMPT } from './prompts'
import { extractJsonObject } from './guides'
import type { SearchBatch, SearchPlan, SearchReflection, SensorResult } from './types'

export function normalizeReflection(value: unknown): SearchReflection {
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

export async function reflectOnSearchResults(
  userText: string,
  plan: SearchPlan,
  batches: SearchBatch[],
  signal?: AbortSignal,
): Promise<SearchReflection> {
  const reflectionMessages: ChatMessage[] = [
    { role: 'system', content: REFLECTION_SYSTEM_PROMPT },
    { role: 'user', content: buildReflectionUserPrompt(userText, plan, batches) },
  ]

  const reply = await chatWithAgentModel(reflectionMessages, 'reflector', signal)
  try {
    return normalizeReflection(extractJsonObject(reply))
  } catch {
    return { status: 'sufficient', revisedQueries: [] }
  }
}

export function detectAnswerRisks(answer: string, batches: SearchBatch[]): SensorResult[] {
  const risks: SensorResult[] = []
  const trimmed = answer.trim()
  const resultCount = batches.reduce((sum, batch) => sum + batch.results.length, 0)

  if (trimmed.length < 20) {
    risks.push({
      ok: false,
      name: 'answer_too_short',
      severity: 'warning',
      message: '回答过短，可能没有完成有效综合。',
    })
  }

  if (/根据搜索结果|我找到了|找到.*论文/.test(answer) && resultCount === 0) {
    risks.push({
      ok: false,
      name: 'claims_results_without_sources',
      severity: 'error',
      message: '回答声称找到了搜索结果，但工具没有返回论文。',
    })
  }

  if (/根据搜索结果|我找到了|找到.*论文/.test(answer) && !/(https?:\/\/|DOI|arXiv|OpenAlex|Crossref|Semantic Scholar)/i.test(answer)) {
    risks.push({
      ok: false,
      name: 'missing_source_markers',
      severity: 'warning',
      message: '回答提到搜索结果，但缺少链接、DOI 或来源标记。',
    })
  }

  return risks.length > 0 ? risks : [{
    ok: true,
    name: 'answer_risk_check',
    severity: 'info',
    message: '未发现明显回答风险。',
  }]
}
