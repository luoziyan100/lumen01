import type { ToolCall, AgentMessage } from '../adapters/types.ts'
import { executeAcademicSearch } from './academic-search.ts'
import { executeReadPapers, type ReadPapersContext } from './read-papers.ts'
import { executeSearchLocalLibrary, type LocalLibraryContext } from './local-library.ts'

export interface ToolExecutionContext extends ReadPapersContext, LocalLibraryContext {
  conversationHistory: AgentMessage[]
}

export async function executeResearchTool(
  toolCall: ToolCall,
  context: ToolExecutionContext,
  signal?: AbortSignal,
): Promise<unknown> {
  try {
    switch (toolCall.name) {
      case 'academic_search':
        return await executeAcademicSearch(toolCall.arguments, signal)
      case 'read_papers':
        return await executeReadPapers(toolCall.arguments, context, signal)
      case 'search_local_library':
        return await executeSearchLocalLibrary(toolCall.arguments, context)
      default:
        return { error: `未知工具: ${toolCall.name}` }
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
