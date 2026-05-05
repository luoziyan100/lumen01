import { searchPapers, type SearchOptions, type SearchResult } from '../../services/search.ts'

export interface AcademicSearchResult {
  total: number
  results: Array<{
    index: number
    title: string
    authors: string[]
    year: number | null
    doi: string | null
    source: string
    source_url: string
    abstract_snippet: string | null
    open_access_url: string | null
    citation_count: number
  }>
}

interface AcademicSearchArgs {
  queries?: unknown
  time_range?: { from_date?: unknown; to_date?: unknown }
  sort?: unknown
  mode?: unknown
  arxiv_categories?: unknown
  limit?: unknown
}

interface SearchBatch {
  total: number
  results: SearchResult[]
}

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
    .sort((a, b) => b.quality_score - a.quality_score)
    .slice(0, limit)
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 3)
}

function boundedLimit(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(20, Math.round(value)))
    : 10
}

function optionsFromArgs(args: AcademicSearchArgs): SearchOptions {
  const mode = args.mode === 'paper_lookup'
    ? 'paper_lookup'
    : args.mode === 'arxiv_feed'
      ? 'arxiv_category_feed'
      : 'keyword_search'
  return {
    fromDate: typeof args.time_range?.from_date === 'string' ? args.time_range.from_date : undefined,
    untilDate: typeof args.time_range?.to_date === 'string' ? args.time_range.to_date : undefined,
    sortMode: args.sort === 'newest' || args.sort === 'balanced' ? args.sort : 'relevance',
    searchMode: mode,
    arxivCategories: Array.isArray(args.arxiv_categories)
      ? args.arxiv_categories.filter((item): item is string => typeof item === 'string')
      : undefined,
    feedLimit: mode === 'arxiv_category_feed' ? boundedLimit(args.limit) : undefined,
    includeTotalCount: mode === 'arxiv_category_feed',
  }
}

function formatResult(result: SearchResult, index: number): AcademicSearchResult['results'][number] {
  return {
    index,
    title: result.title,
    authors: result.authors.map((author) => author.name),
    year: result.year,
    doi: result.doi,
    source: result.source,
    source_url: result.source_url,
    abstract_snippet: result.abstract_text ? result.abstract_text.slice(0, 800) : null,
    open_access_url: result.open_access_pdf_url ?? result.open_access_url ?? result.open_access_landing_url,
    citation_count: result.citation_count,
  }
}

export async function executeAcademicSearch(rawArgs: Record<string, unknown>, signal?: AbortSignal): Promise<AcademicSearchResult> {
  const args = rawArgs as AcademicSearchArgs
  const queries = stringArray(args.queries, ['large language model research'])
  const limit = boundedLimit(args.limit)
  const options = optionsFromArgs(args)
  const batches: SearchBatch[] = []

  for (const query of queries) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    batches.push(await searchPapers(query, limit, options, signal))
  }

  const merged = mergeSearchBatches(batches, limit)
  return {
    total: merged.length,
    results: merged.map((result, index) => formatResult(result, index + 1)),
  }
}
