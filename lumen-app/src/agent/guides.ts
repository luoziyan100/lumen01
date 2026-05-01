/**
 * [INPUT]: 依赖 services/ai 与 agent/prompts
 * [OUTPUT]: 对外提供意图规划、JSON 解析和 planner 归一化逻辑
 * [POS]: agent 模块的 guide 层，负责把用户输入转成受控 SearchPlan
 */
import { chatWithAI, type ChatMessage } from '../services/ai'
import { buildPlannerUserPrompt, PLANNER_SYSTEM_PROMPT } from './prompts'
import type { ResearchIntent, RunResearchHarnessInput, SearchPlan } from './types'

export const DEFAULT_PLAN: SearchPlan = {
  intent: 'answer',
  shouldSearch: false,
  queries: [],
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

export function compactRecentMessages(messages: ChatMessage[]): string {
  return messages.slice(-6).map((message) => {
    const text = message.content.replace(/\s+/g, ' ').slice(0, 600)
    return `${message.role}: ${text}`
  }).join('\n')
}

export async function planResearchAction(input: RunResearchHarnessInput): Promise<SearchPlan> {
  const plannerMessages: ChatMessage[] = [
    { role: 'system', content: PLANNER_SYSTEM_PROMPT },
    {
      role: 'user',
      content: buildPlannerUserPrompt(
        compactRecentMessages(input.recentMessages),
        input.userText,
      ),
    },
  ]

  const reply = await chatWithAI(plannerMessages, undefined, input.signal)
  try {
    return normalizePlan(extractJsonObject(reply))
  } catch {
    return DEFAULT_PLAN
  }
}
