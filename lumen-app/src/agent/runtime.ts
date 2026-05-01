/**
 * [INPUT]: 依赖 agent/guides、agent/tools、agent/sensors、agent/prompts、services/ai
 * [OUTPUT]: 对外提供 runResearchHarness
 * [POS]: agent 模块的统一运行时，编排规划、工具、传感器、综合回答与本地 trace
 */
import { chatWithAI, type ChatMessage } from '../services/ai'
import { planResearchAction } from './guides'
import { buildSynthesisUserPrompt } from './prompts'
import { detectAnswerRisks, reflectOnSearchResults } from './sensors'
import { runAcademicSearches } from './tools'
import {
  createAgentRun,
  failAgentRun,
  finishAgentRun,
  recordAgentStep,
} from './traces'
import type {
  ResearchAgentResult,
  RunResearchHarnessInput,
  SearchBatch,
  SearchPlan,
  SearchReflection,
} from './types'

function isMissingAiConfigError(error: unknown): boolean {
  return String(error).includes('请先在设置中配置 AI API Key')
}

async function synthesizeAnswer(
  input: RunResearchHarnessInput,
  plan: SearchPlan,
  batches: SearchBatch[],
  reflection?: SearchReflection,
): Promise<string> {
  const synthesisMessages: ChatMessage[] = [
    ...input.history,
    {
      role: 'user',
      content: buildSynthesisUserPrompt(input.userText, plan, batches, reflection),
    },
  ]

  return chatWithAI(synthesisMessages, undefined, input.signal)
}

export async function runResearchHarness(input: RunResearchHarnessInput): Promise<ResearchAgentResult> {
  const trace = createAgentRun(input.userText)
  let plan: SearchPlan

  try {
    try {
      plan = await recordAgentStep(
        trace,
        'guide',
        'plan_research_action',
        { userText: input.userText, recentMessages: input.recentMessages },
        () => planResearchAction(input),
      )
    } catch (error) {
      if (!isMissingAiConfigError(error)) throw error
      plan = {
        intent: 'clarify',
        shouldSearch: false,
        queries: [],
        reason: 'missing_ai_config',
      }
      const reply = '搜索 Agent 需要先连接一个 AI 模型，才能理解你的意图、改写检索 query、判断结果是否相关。请先在设置里配置 API Key；配置后它不会再把“搜索结果不准确”这类反馈当作关键词去搜。'
      finishAgentRun(trace)
      return { reply, searched: false, plan, trace }
    }

    if (plan.intent === 'feedback') {
      const reply = plan.response || '收到，这属于对上一轮搜索质量的反馈。我会调整查询规划和结果评估，不会把这句话本身当成检索关键词。'
      finishAgentRun(trace)
      return { reply, searched: false, plan, trace }
    }

    if (plan.intent === 'clarify') {
      const reply = plan.response || '你想让我优先搜索哪一类论文或哪个具体主题？'
      finishAgentRun(trace)
      return { reply, searched: false, plan, trace }
    }

    if (!plan.shouldSearch) {
      const reply = await recordAgentStep(
        trace,
        'model',
        'direct_answer',
        { historyLength: input.history.length },
        () => chatWithAI(input.history, undefined, input.signal),
      )
      finishAgentRun(trace)
      return { reply, searched: false, plan, trace }
    }

    const searchResult = await recordAgentStep(
      trace,
      'tool',
      'academic_search',
      { queries: plan.queries },
      () => runAcademicSearches(plan.queries, input.signal),
    )
    if (!searchResult.ok || !searchResult.data) {
      throw new Error(searchResult.error ?? '学术搜索失败')
    }

    let batches = searchResult.data
    let reflection = await recordAgentStep(
      trace,
      'sensor',
      'reflect_on_search_results',
      { userText: input.userText, plan, resultCount: batches.reduce((sum, batch) => sum + batch.results.length, 0) },
      () => reflectOnSearchResults(input.userText, plan, batches, input.signal),
    )

    if (reflection.status === 'retry' && reflection.revisedQueries.length > 0) {
      const retryResult = await recordAgentStep(
        trace,
        'tool',
        'academic_search_retry',
        { queries: reflection.revisedQueries },
        () => runAcademicSearches(reflection.revisedQueries, input.signal),
      )
      if (!retryResult.ok || !retryResult.data) {
        throw new Error(retryResult.error ?? '重试搜索失败')
      }
      batches = [...batches, ...retryResult.data]
      reflection = {
        ...reflection,
        status: retryResult.data.some((batch) => batch.results.length > 0) ? 'sufficient' : 'not_found',
      }
    }

    const reply = await recordAgentStep(
      trace,
      'model',
      'synthesize_answer',
      { plan, reflection, searchBatchCount: batches.length },
      () => synthesizeAnswer(input, plan, batches, reflection),
    )
    const risks = await recordAgentStep(
      trace,
      'sensor',
      'detect_answer_risks',
      { answerLength: reply.length },
      async () => detectAnswerRisks(reply, batches),
    )

    finishAgentRun(trace)
    return { reply, searched: true, plan, reflection, risks, trace }
  } catch (error) {
    failAgentRun(trace, error)
    throw error
  }
}
