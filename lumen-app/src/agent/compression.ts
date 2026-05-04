/**
 * [INPUT]: 依赖 services/ai 与 agent/types
 * [OUTPUT]: 对外提供聊天历史压缩钩子
 * [POS]: agent 模块的 context budget 保护层，当前只记录预算，不压缩结构化对象
 */
import type { ChatMessage } from '../services/ai'
import type { RunResearchHarnessInput } from './types'

export interface CompressionBudget {
  maxTokens: number
  softLimitRatio?: number
}

export interface CompressionResult {
  messages: ChatMessage[]
  compressionApplied: boolean
  estimatedTokens: number
  preservedObjects: string[]
}

function estimateTokens(messages: ChatMessage[]): number {
  const chars = messages.reduce((sum, message) => sum + message.content.length, 0)
  return Math.ceil(chars / 4)
}

export function maybeCompressChatHistory(
  input: RunResearchHarnessInput,
  budget: CompressionBudget,
): CompressionResult {
  const estimatedTokens = estimateTokens(input.recentMessages)
  const softLimit = budget.maxTokens * (budget.softLimitRatio ?? 0.8)
  const preservedObjects = [
    input.context.currentPaper ? 'currentPaper' : null,
    input.context.activeSearchResultSetId ? 'activeSearchResultSet' : null,
    input.context.recentSearchResultSets?.length ? 'recentSearchResultSets' : null,
    input.context.resolvedQuestion ? 'resolvedQuestion' : null,
  ].filter((value): value is string => Boolean(value))

  if (estimatedTokens < softLimit) {
    return {
      messages: input.recentMessages,
      compressionApplied: false,
      estimatedTokens,
      preservedObjects,
    }
  }

  // 当前模型上下文预算很大，先不自动摘要；只保留钩子和可观测性，避免压坏关键事实。
  return {
    messages: input.recentMessages,
    compressionApplied: false,
    estimatedTokens,
    preservedObjects,
  }
}
