/**
 * [INPUT]: 依赖 agent/types
 * [OUTPUT]: 对外提供本地 AgentRun/AgentStep trace 构造与步骤记录工具
 * [POS]: agent 模块的可观察性基础层，第一阶段只在内存中返回 trace
 */
import type { AgentRun, AgentStep, AgentStepType } from './types'

function newId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${random}`
}

function now(): string {
  return new Date().toISOString()
}

function compactTraceValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length > 3000 ? `${value.slice(0, 3000)}...` : value
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(compactTraceValue)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, compactTraceValue(entry)]),
    )
  }
  return value
}

export function createAgentRun(userText: string): AgentRun {
  return {
    id: newId('run'),
    kind: 'research',
    userText,
    startedAt: now(),
    status: 'running',
    steps: [],
  }
}

export async function recordAgentStep<T>(
  run: AgentRun,
  type: AgentStepType,
  name: string,
  input: unknown,
  task: () => Promise<T>,
): Promise<T> {
  const step: AgentStep = {
    id: newId('step'),
    type,
    name,
    startedAt: now(),
    input: compactTraceValue(input),
  }
  run.steps.push(step)

  try {
    const output = await task()
    step.output = compactTraceValue(output)
    step.finishedAt = now()
    return output
  } catch (error) {
    step.error = error instanceof Error ? error.message : String(error)
    step.finishedAt = now()
    throw error
  }
}

export function finishAgentRun(run: AgentRun): void {
  run.status = 'succeeded'
  run.finishedAt = now()
}

export function failAgentRun(run: AgentRun, error: unknown): void {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  run.status = message.toLowerCase().includes('abort') ? 'cancelled' : 'failed'
  run.finishedAt = now()
}
