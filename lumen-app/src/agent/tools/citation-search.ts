import { searchCitations, searchReferences, type SearchResponse, type SearchResult } from '../../services/search.ts'
export interface CitationSearchResult {
  paper_id: string
  direction: 'citations' | 'references'
  total: number
  results: Array<{
    index: number
    title: string
    authors: string[]
    year: number | null
    published_date: string | null
    doi: string | null
    source: string
    source_url: string
    abstract_snippet: string | null
    citation_count: number
    journal: string | null
  }>
}
type CitationSearchFn = (paperId: string, limit?: number, signal?: AbortSignal) => Promise<SearchResponse>
function formatResult(result: SearchResult, index: number): CitationSearchResult['results'][number] {
  return {
    index,
    title: result.title,
    authors: result.authors.map((author) => author.name),
    year: result.year,
    published_date: result.published_date,
    doi: result.doi,
    source: result.source,
    source_url: result.source_url,
    abstract_snippet: result.abstract_text ? result.abstract_text.slice(0, 1200) : null,
    citation_count: result.citation_count,
    journal: result.journal,
  }
}
async function executeCitationTool(
  rawArgs: Record<string, unknown>,
  direction: CitationSearchResult['direction'],
  signal: AbortSignal | undefined,
  search: CitationSearchFn,
): Promise<CitationSearchResult> {
  const paperId = typeof rawArgs.paper_id === 'string' ? rawArgs.paper_id.trim() : ''
  if (!paperId) return { paper_id: '', direction, total: 0, results: [] }
  const response = await search(paperId, 20, signal)
  return {
    paper_id: paperId,
    direction,
    total: response.results.length,
    results: response.results.map((result, index) => formatResult(result, index + 1)),
  }
}
export async function executeCitationSearch(rawArgs: Record<string, unknown>, signal?: AbortSignal, search: CitationSearchFn = searchCitations): Promise<CitationSearchResult> {
  return executeCitationTool(rawArgs, 'citations', signal, search)
}
export async function executeReferenceSearch(rawArgs: Record<string, unknown>, signal?: AbortSignal, search: CitationSearchFn = searchReferences): Promise<CitationSearchResult> {
  return executeCitationTool(rawArgs, 'references', signal, search)
}
