import { searchPapers, type SearchResponse, type SearchResult } from '../../services/search.ts'

export interface AcademicSearchResult {
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
    open_access_url: string | null
    citation_count: number
    journal: string | null
  }>
}

interface SearchBatch {
  total: number
  results: SearchResult[]
}

type SearchPapersFn = (
  query: string,
  limit: number,
  options: { sortMode: 'newest' },
  signal?: AbortSignal,
) => Promise<SearchResponse>

function searchResultKey(result: SearchResult): string {
  if (result.doi) return `doi:${result.doi.toLowerCase()}`
  return `title:${result.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`
}

export function mergeSearchBatches(batches: SearchBatch[], limit: number): SearchResult[] {
  const byKey = new Map<string, SearchResult>()
  for (const result of batches.flatMap((batch) => batch.results)) {
    const key = searchResultKey(result)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { ...result, authors: [...result.authors] })
      continue
    }
    if (!existing.abstract_text) existing.abstract_text = result.abstract_text
    if (!existing.open_access_url) existing.open_access_url = result.open_access_url
    if (!existing.open_access_pdf_url) existing.open_access_pdf_url = result.open_access_pdf_url
    if (!existing.open_access_landing_url) existing.open_access_landing_url = result.open_access_landing_url
    if (!existing.journal) existing.journal = result.journal
    if (!existing.doi) existing.doi = result.doi
    if (!existing.published_date) existing.published_date = result.published_date
    existing.citation_count = Math.max(existing.citation_count, result.citation_count)
    existing.quality_score = Math.max(existing.quality_score, result.quality_score)
    existing.is_top_journal ||= result.is_top_journal
    if (!existing.source.includes(result.source)) existing.source = `${existing.source} / ${result.source}`
  }
  return Array.from(byKey.values())
    .sort((a, b) => {
      const dateA = a.published_date ?? ''
      const dateB = b.published_date ?? ''
      if (dateA !== dateB) return dateB.localeCompare(dateA)
      return b.quality_score - a.quality_score
    })
    .slice(0, limit)
}

function formatResult(result: SearchResult, index: number): AcademicSearchResult['results'][number] {
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
    open_access_url: result.open_access_pdf_url ?? result.open_access_url ?? result.open_access_landing_url,
    citation_count: result.citation_count,
    journal: result.journal,
  }
}

export async function executeAcademicSearch(
  rawArgs: Record<string, unknown>,
  signal?: AbortSignal,
  search: SearchPapersFn = searchPapers,
): Promise<AcademicSearchResult> {
  const query = typeof rawArgs.query === 'string' ? rawArgs.query.trim() : ''
  if (!query) return { total: 0, results: [] }

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const batches = [await search(query, 20, { sortMode: 'newest' }, signal)]

  const merged = mergeSearchBatches(batches, 20)
  return {
    total: merged.length,
    results: merged.map((result, index) => formatResult(result, index + 1)),
  }
}
