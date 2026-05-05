/**
 * [INPUT]: 无运行时依赖
 * [OUTPUT]: 对外提供 Research Agent 目标 pipeline 阶段名
 * [POS]: agent pipeline 的架构契约，供 runtime 和测试共同引用
 */

export const RESEARCH_PIPELINE_STAGE_NAMES = [
  'context_loader',
  'context_retrieval',
  'question_resolution',
  'planner_context_pack',
  'planner_decision',
  'runtime_guard',
  'tool_runtime',
  'tool_evidence',
  'synthesis_context_pack',
  'synthesis',
  'state_writeback',
  'compression_hook',
] as const

export function getResearchPipelineStageNames(): string[] {
  return [...RESEARCH_PIPELINE_STAGE_NAMES]
}
