import type { AgentMessage } from './adapters/types.ts'

export interface HistoryWindowOptions {
  maxMessages?: number
  maxToolResults?: number
  preserveLatestN?: number
}

const DEFAULT_MAX_MESSAGES = 40
const DEFAULT_MAX_TOOL_RESULTS = 20
const DEFAULT_PRESERVE_LATEST = 10
const TOOL_RESULT_PREVIEW_CHARS = 500
const TRUNCATED_SUFFIX = '...[truncated]'

interface WindowEntry {
  message: AgentMessage
  preserve: boolean
  remove: boolean
}

function optionValue(value: number | undefined, fallback: number, min: number): number {
  return Math.max(min, Math.floor(value ?? fallback))
}

function truncateToolResult(message: AgentMessage): AgentMessage {
  if (message.role !== 'tool_result' || message.content.length <= TOOL_RESULT_PREVIEW_CHARS) return message
  return {
    ...message,
    content: `${message.content.slice(0, TOOL_RESULT_PREVIEW_CHARS)}${TRUNCATED_SUFFIX}`,
  }
}

function removeOldestConversationPair(entries: WindowEntry[]): boolean {
  let removed = 0
  for (const entry of entries) {
    if (removed >= 2) return true
    if (entry.remove || entry.preserve) continue
    if (entry.message.role !== 'user' && entry.message.role !== 'assistant') continue
    entry.remove = true
    removed += 1
  }
  return removed > 0
}

export function trimHistory(
  history: AgentMessage[],
  options: HistoryWindowOptions = {},
): AgentMessage[] {
  const maxMessages = optionValue(options.maxMessages, DEFAULT_MAX_MESSAGES, 1)
  const maxToolResults = optionValue(options.maxToolResults, DEFAULT_MAX_TOOL_RESULTS, 0)
  const preserveLatestN = optionValue(options.preserveLatestN, DEFAULT_PRESERVE_LATEST, 0)
  const preserveStart = Math.max(0, history.length - preserveLatestN)
  const entries = history.map((message, index) => ({
    message,
    preserve: message.role === 'system' || index >= preserveStart,
    remove: false,
  }))

  const oldToolResults = entries.filter((entry) => (
    !entry.preserve && entry.message.role === 'tool_result'
  ))
  if (oldToolResults.length > maxToolResults) {
    for (const entry of oldToolResults) entry.message = truncateToolResult(entry.message)
  }

  while (entries.filter((entry) => !entry.remove).length > maxMessages) {
    if (!removeOldestConversationPair(entries)) break
  }

  return entries.filter((entry) => !entry.remove).map((entry) => entry.message)
}
