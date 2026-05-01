/**
 * [INPUT]: 依赖 agent/runtime
 * [OUTPUT]: 对外保留 runResearchAgent 兼容导出
 * [POS]: services 层的兼容入口，实际实现迁移到 src/agent harness
 */
export { runResearchHarness as runResearchAgent } from '../agent/runtime'
export type { ResearchAgentResult } from '../agent/types'
