/**
 * [INPUT]: 依赖 ResearchAgentResult
 * [OUTPUT]: 对外提供 ResearchWritebackPlan
 * [POS]: agent pipeline 的 State Writeback 规划层，不直接调用 React 或 storage
 */
import type { ResearchAgentResult, ResearchWritebackPlan, SearchResultSet } from './types.ts'

export interface BuildResearchWritebackPlanOptions {
  query?: string
  nextSearchResultSetLabel?: string
  assistantNoteId?: string
  now?: () => string
  createResultSetId?: () => string
}

function defaultResultSetId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `rs-${random}`
}

function fallbackSearchResultSet(
  result: ResearchAgentResult,
  options: Required<Pick<BuildResearchWritebackPlanOptions, 'query' | 'nextSearchResultSetLabel' | 'now' | 'createResultSetId'>>,
): SearchResultSet | undefined {
  if (!result.searchResults?.length) return undefined
  return {
    id: options.createResultSetId(),
    label: options.nextSearchResultSetLabel,
    query: options.query,
    plan: result.plan,
    mode: result.plan.searchMode,
    fetched: result.searchResults.length,
    categories: result.plan.arxivCategories,
    fromDate: result.plan.timeRange?.fromDate,
    untilDate: result.plan.timeRange?.untilDate,
    results: result.searchResults,
    createdAt: options.now(),
  }
}

export function buildResearchWritebackPlan(
  result: ResearchAgentResult,
  options: BuildResearchWritebackPlanOptions = {},
): ResearchWritebackPlan {
  const resolvedOptions = {
    query: options.query ?? (result.plan.queries.join('; ') || result.plan.reason || '研究请求'),
    nextSearchResultSetLabel: options.nextSearchResultSetLabel ?? result.searchResultSetLabel ?? 'R1',
    now: options.now ?? (() => new Date().toISOString()),
    createResultSetId: options.createResultSetId ?? defaultResultSetId,
  }
  const noteId = options.assistantNoteId ?? null
  const artifacts: ResearchWritebackPlan['artifacts'] = []
  const state: ResearchWritebackPlan['state'] = {}

  if (result.searched && result.searchResults?.length) {
    const resultSet = {
      ...(result.searchResultSet ?? fallbackSearchResultSet(result, resolvedOptions)),
      noteId: options.assistantNoteId,
    } as SearchResultSet
    state.searchResultSet = resultSet
    state.lastSearchResults = resultSet.results
    artifacts.push({
      type: 'search_results',
      noteId,
      data: {
        resultSet,
        results: resultSet.results,
        plan: result.plan,
        traceId: result.trace.id,
        createdAt: resultSet.createdAt,
      },
    })
  }
  if (result.currentPaper) {
    state.currentPaper = result.currentPaper
    artifacts.push({
      type: 'current_paper',
      noteId,
      data: {
        paper: result.currentPaper,
        evidenceLevel: result.currentPaperEvidenceLevel,
        source: result.plan.intent,
        sourceResultSetId: result.sourceResultSetId ?? result.searchResultSet?.id ?? state.searchResultSet?.id,
        createdAt: resolvedOptions.now(),
      },
    })
  }
  if (result.paperEvidenceNotes?.length) {
    artifacts.push({
      type: 'paper_preview',
      noteId,
      data: {
        papers: result.paperEvidenceNotes.map((note) => ({
          paper: note.paper,
          title: note.paper.title,
          doi: note.paper.doi,
          source: note.paper.source,
          sourceUrl: note.paper.source_url,
          openAccessUrl: note.paper.open_access_pdf_url ?? note.paper.open_access_url,
          sourceResultSetId: result.sourceResultSetId ?? result.searchResultSet?.id ?? state.searchResultSet?.id,
          evidenceLevel: note.evidenceLevel,
          evidenceSource: note.evidenceSource,
          pdfUrl: note.pdfUrl,
          pdfTempPath: note.pdfTempPath,
          cacheHit: note.cacheHit,
          pdfCacheHit: note.pdfCacheHit,
          warning: note.warning,
        })),
        plan: result.plan,
        traceId: result.trace.id,
        createdAt: resolvedOptions.now(),
      },
    })
  }
  if (result.deepResearchReport) {
    artifacts.push({
      type: 'deep_research_report',
      noteId,
      data: {
        ...result.deepResearchReport,
        plan: result.plan,
        traceId: result.trace.id,
      },
    })
  }
  return {
    assistantReply: result.reply,
    artifacts,
    state,
  }
}
