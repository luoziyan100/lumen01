/**
 * [INPUT]: 无外部依赖
 * [OUTPUT]: 对外提供 AgentRun / AgentStep / AgentStepType / AgentRunStatus 类型
 * [POS]: agent 模块的 trace 类型定义
 */

export type AgentRunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'

export type AgentStepType = 'model' | 'tool' | 'output'

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
