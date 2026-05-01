/**
 * [INPUT]: 依赖 agent/types
 * [OUTPUT]: 对外提供 Research Harness 的 planner/reflector/synthesizer prompt 构造函数
 * [POS]: agent 模块的提示词集中存放点，方便后续 feedback loop 写回规则
 */
import type { SearchBatch, SearchPlan, SearchReflection } from './types'
import { formatSearchBatches, mergeSearchBatches } from './tools'
import { formatSearchResults } from '../services/search'

export const PLANNER_SYSTEM_PROMPT = `你是 Lumen 的学术搜索 Agent 规划器。你只负责决定下一步动作，不直接回答长篇内容。

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
- response 只在 feedback 或 clarify 时填写；其他情况可以为空。`

export const REFLECTION_SYSTEM_PROMPT = `你是学术搜索结果评估器。判断当前搜索结果是否足以回答用户问题。

返回严格 JSON，不要 Markdown。Schema:
{
  "status": "sufficient" | "retry" | "not_found",
  "revisedQueries": string[],
  "reason": string
}

如果结果明显跑题，给出 1-2 条更精准的英文 revisedQueries。只允许重试一次，因此 revisedQueries 要尽量高质量。`

export function buildPlannerUserPrompt(recentMessages: string, userText: string): string {
  return `最近对话：
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
  return `搜索 Agent 已完成外部学术检索。

用户原始问题：
${userText}

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
- 使用简体中文和 Markdown`
}
