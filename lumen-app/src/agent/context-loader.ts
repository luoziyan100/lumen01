/**
 * [INPUT]: 依赖 RunResearchHarnessInput
 * [OUTPUT]: 对外提供 LoadedResearchContext
 * [POS]: agent pipeline 的 Context Loader，显式读取 history、artifacts 和 active objects
 */
import type { RunResearchHarnessInput, SearchResultSet } from './types.ts'

export interface LoadedResearchContext extends RunResearchHarnessInput {
  activeResultSet?: SearchResultSet
}

export function loadResearchContext(input: RunResearchHarnessInput): LoadedResearchContext {
  const sets = input.context.recentSearchResultSets ?? []
  const activeResultSet = sets.find((set) => set.id === input.context.activeSearchResultSetId) ?? sets[0]
  return {
    ...input,
    activeResultSet,
  }
}
