/**
 * [INPUT]: 依赖 agent/loop
 * [OUTPUT]: 对外保留 runResearchAgent 兼容导出
 * [POS]: services 层的兼容入口，实际实现迁移到 Agent Loop
 */
export { runAgentLoop as runResearchAgent } from '../agent/loop'
export type { AgentLoopResult as ResearchAgentResult } from '../agent/loop'
