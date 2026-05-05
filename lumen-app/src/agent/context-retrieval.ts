/**
 * [INPUT]: 依赖 LoadedResearchContext
 * [OUTPUT]: 对外提供结构化对象检索结果
 * [POS]: agent pipeline 的 Context Retrieval，先做轻量结构化对象检索
 */
import type { SearchResult } from '../services/search'
import type { RunResearchHarnessInput, SearchResultSet } from './types.ts'
import type { LoadedResearchContext } from './context-loader.ts'

export interface RetrievedResearchObjects {
  activeResultSet?: SearchResultSet
  currentPaper?: SearchResult
  recentResultSets: SearchResultSet[]
}

export function retrieveActiveResearchObjects(input: LoadedResearchContext): RetrievedResearchObjects {
  return {
    activeResultSet: input.activeResultSet,
    currentPaper: input.context.currentPaper ?? undefined,
    recentResultSets: input.context.recentSearchResultSets ?? [],
  }
}

export function applyRetrievedResearchObjects(
  input: RunResearchHarnessInput,
  objects: RetrievedResearchObjects,
): RunResearchHarnessInput {
  return {
    ...input,
    context: {
      ...input.context,
      currentPaper: objects.currentPaper,
      activeSearchResultSetId: objects.activeResultSet?.id ?? input.context.activeSearchResultSetId,
      recentSearchResultSets: objects.recentResultSets,
      lastSearchResults: objects.activeResultSet?.results ?? input.context.lastSearchResults,
    },
  }
}
