/**
 * [INPUT]: 依赖 services/ai 与 services/search 的公共类型
 * [OUTPUT]: 对外提供 Research Harness 的运行、步骤、计划、工具和传感器类型
 * [POS]: agent 模块的类型边界，供 guides/tools/sensors/runtime 共享
 */
import type { ChatMessage } from '../services/ai'
import type { SearchResult } from '../services/search'

export type ResearchIntent =
  | 'academic_search'
  | 'local_research'
  | 'answer'
  | 'feedback'
  | 'clarify'

export type AgentRunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'
export type AgentStepType = 'guide' | 'model' | 'tool' | 'sensor' | 'output'

export interface AgentRun {
  id: string
  kind: 'research'
  userText: string
  startedAt: string
  finishedAt?: string
  status: AgentRunStatus
  steps: AgentStep[]
}

export interface AgentStep {
  id: string
  type: AgentStepType
  name: string
  startedAt: string
  finishedAt?: string
  input?: unknown
  output?: unknown
  error?: string
}

export interface SearchPlan {
  intent: ResearchIntent
  shouldSearch: boolean
  queries: string[]
  response?: string
  reason?: string
}

export interface SearchReflection {
  status: 'sufficient' | 'retry' | 'not_found'
  revisedQueries: string[]
  reason?: string
}

export interface SearchBatch {
  query: string
  total: number
  results: SearchResult[]
}

export interface SensorResult {
  ok: boolean
  name: string
  severity: 'info' | 'warning' | 'error'
  message: string
}

export interface ToolResult<T> {
  ok: boolean
  data?: T
  error?: string
}

export interface RunResearchHarnessInput {
  userText: string
  history: ChatMessage[]
  recentMessages: ChatMessage[]
  signal?: AbortSignal
}

export interface ResearchAgentResult {
  reply: string
  searched: boolean
  plan: SearchPlan
  reflection?: SearchReflection
  risks?: SensorResult[]
  trace: AgentRun
}
