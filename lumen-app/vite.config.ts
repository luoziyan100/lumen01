import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'node:http'

interface DevSearchAuthor {
  name: string
}

interface DevSearchResult {
  id: string
  title: string
  abstract_text: string | null
  authors: DevSearchAuthor[]
  year: number | null
  citation_count: number
  open_access_url: string | null
  open_access_pdf_url: string | null
  open_access_landing_url: string | null
  source_url: string
  source: string
  journal: string | null
  doi: string | null
  published_date: string | null
  is_top_journal: boolean
  quality_score: number
}

interface DevSearchOptions {
  fromDate?: string
  untilDate?: string
  sortMode?: 'relevance' | 'newest' | 'balanced'
  searchMode?: 'keyword_search' | 'paper_lookup' | 'recent_ai_feed' | 'arxiv_category_feed'
  sourceHint?: 'all' | 'arxiv' | 'openalex' | 'semantic_scholar' | 'crossref'
  categoryPreset?: 'ai' | 'llm' | 'vision' | 'robotics' | 'custom'
  arxivCategories?: string[]
  feedLimit?: number
  includeTotalCount?: boolean
}

interface OpenAlexWork {
  id?: string
  title?: string
  doi?: string
  authorships?: Array<{ author?: { display_name?: string } }>
  publication_year?: number
  publication_date?: string
  cited_by_count?: number
  open_access?: { oa_url?: string }
  primary_location?: OpenAlexLocation
  best_oa_location?: OpenAlexLocation
  abstract_inverted_index?: Record<string, number[]>
}

interface OpenAlexLocation {
  landing_page_url?: string
  pdf_url?: string
  source?: { display_name?: string }
}

interface SemanticPaper {
  paperId?: string
  title?: string
  abstract?: string
  year?: number
  publicationDate?: string
  citationCount?: number
  url?: string
  openAccessPdf?: { url?: string }
  authors?: Array<{ name?: string }>
  venue?: string
  journal?: { name?: string }
  externalIds?: { DOI?: string }
}

interface CrossrefWork {
  DOI?: string
  title?: string[]
  author?: Array<{ given?: string; family?: string; name?: string }>
  'container-title'?: string[]
  'is-referenced-by-count'?: number
  URL?: string
  'published-print'?: CrossrefDate
  'published-online'?: CrossrefDate
  published?: CrossrefDate
  abstract?: string
}

interface CrossrefDate {
  'date-parts'?: number[][]
}

interface DevImageData {
  base64: string
  mediaType: string
}

interface DevChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: DevImageData[]
}

interface DevAiChatRequest {
  provider?: string
  apiKey?: string
  model?: string
  endpoint?: string
  temperature?: number
  maxTokens?: number
  responseFormat?: 'json' | 'text'
  messages?: DevChatMessage[]
}

interface DevOpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>
}

interface DevAnthropicResponse {
  content?: Array<{ text?: string }>
}

const MAX_PREVIEW_PDF_BYTES = 50 * 1024 * 1024
const MAX_PUBLIC_HTML_BYTES = 2 * 1024 * 1024
const BLOCKED_PUBLIC_HOSTS = [
  'sci-hub',
  'libgen',
  'librarygenesis',
  'z-lib',
  'zlibrary',
  'annas-archive',
]

const TOP_JOURNALS = [
  'nature',
  'science',
  'cell',
  'pnas',
  'proceedings of the national academy of sciences',
  'nature neuroscience',
  'nature reviews neuroscience',
  'nature human behaviour',
  'neuron',
  'trends in cognitive sciences',
  'trends in neurosciences',
  'annual review of psychology',
  'annual review of neuroscience',
  'psychological review',
  'the lancet neurology',
  'brain',
  'journal of neuroscience',
  'cerebral cortex',
  'neuroimage',
  'human brain mapping',
  'cognition',
  'cognitive psychology',
  'cognitive science',
  'journal of cognitive neuroscience',
  'developmental cognitive neuroscience',
  'psychological science',
  'nature methods',
  'nature communications',
  'science advances',
  'neuroscience and biobehavioral reviews',
  'neuroscience biobehavioral reviews',
  'biological psychiatry',
  'molecular psychiatry',
  'current biology',
  'elife',
  'plos biology',
  'journal of experimental psychology general',
  'psychonomic bulletin review',
  'memory cognition',
  'attention perception psychophysics',
  'neuropsychologia',
  'social cognitive and affective neuroscience',
  'communications biology',
  'communications psychology',
  'nature mental health',
  'scientific reports',
  'royal society open science',
  'frontiers in human neuroscience',
  'frontiers in neuroscience',
  'brain and cognition',
  'consciousness and cognition',
  'cognitive neuropsychology',
  'hippocampus',
  'npj science of learning',
]

const ARXIV_CATEGORY_PRESETS = {
  ai: ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV', 'cs.RO', 'stat.ML'],
  llm: ['cs.CL', 'cs.AI', 'cs.LG'],
  vision: ['cs.CV', 'eess.IV', 'cs.LG'],
  robotics: ['cs.RO', 'cs.AI', 'cs.LG'],
} as const

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

function normalizeDoi(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/doi\.org\//, '')
    .replace(/^doi:/, '')
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function stripMarkup(value: string): string {
  return decodeXml(value.replace(/<[^>]+>/g, ' '))
}

function blockedPublicUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return BLOCKED_PUBLIC_HOSTS.some((blocked) => lower.includes(blocked))
}

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function cleanSearchOptions(options: DevSearchOptions): DevSearchOptions {
  const searchMode = options.searchMode === 'recent_ai_feed'
    || options.searchMode === 'arxiv_category_feed'
    || options.searchMode === 'paper_lookup'
    ? options.searchMode
    : 'keyword_search'
  const categoryPreset = options.categoryPreset === 'llm'
    || options.categoryPreset === 'vision'
    || options.categoryPreset === 'robotics'
    || options.categoryPreset === 'custom'
    || options.categoryPreset === 'ai'
    ? options.categoryPreset
    : undefined
  return {
    fromDate: isIsoDate(options.fromDate) ? options.fromDate : undefined,
    untilDate: isIsoDate(options.untilDate) ? options.untilDate : undefined,
    sortMode: options.sortMode === 'newest' || options.sortMode === 'balanced' ? options.sortMode : 'relevance',
    searchMode,
    sourceHint: options.sourceHint === 'arxiv' || options.sourceHint === 'openalex' || options.sourceHint === 'semantic_scholar' || options.sourceHint === 'crossref'
      ? options.sourceHint
      : 'all',
    categoryPreset,
    arxivCategories: options.arxivCategories?.filter((category) => /^[a-z-]+\.[A-Z]{2}$/i.test(category)).slice(0, 12),
    feedLimit: options.feedLimit ? Math.max(1, Math.min(200, Math.round(options.feedLimit))) : undefined,
    includeTotalCount: options.includeTotalCount,
  }
}

function dateFromYear(year: number | null): string | null {
  return year ? `${year}-01-01` : null
}

function publicationDateFor(result: DevSearchResult): string | null {
  return result.published_date ?? dateFromYear(result.year)
}

function publicationTimestamp(result: DevSearchResult): number | null {
  const date = publicationDateFor(result)
  if (!date) return null
  const timestamp = Date.parse(date)
  return Number.isFinite(timestamp) ? timestamp : null
}

function isWithinDateRange(result: DevSearchResult, options: DevSearchOptions): boolean {
  if (!options.fromDate && !options.untilDate) return true
  const date = publicationDateFor(result)
  if (!date) return false
  if (options.fromDate && date < options.fromDate) return false
  if (options.untilDate && date > options.untilDate) return false
  return true
}

function crossrefPublishedDate(work: CrossrefWork): string | null {
  const parts = work['published-online']?.['date-parts']?.[0]
    ?? work['published-print']?.['date-parts']?.[0]
    ?? work.published?.['date-parts']?.[0]
  const year = parts?.[0]
  if (!year) return null
  const month = String(parts[1] ?? 1).padStart(2, '0')
  const day = String(parts[2] ?? 1).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function compactDateForArxiv(date: string, endOfDay: boolean): string {
  return `${date.slice(0, 4)}${date.slice(5, 7)}${date.slice(8, 10)}${endOfDay ? '2359' : '0000'}`
}

function arxivCategoriesForOptions(options: DevSearchOptions): string[] {
  if (options.arxivCategories?.length) return options.arxivCategories
  const preset = options.categoryPreset && options.categoryPreset !== 'custom' ? options.categoryPreset : 'ai'
  return [...ARXIV_CATEGORY_PRESETS[preset]]
}

function reconstructAbstract(index?: Record<string, number[]>): string | null {
  if (!index) return null
  const words: Array<[number, string]> = []
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) words.push([pos, word])
  }
  words.sort((a, b) => a[0] - b[0])
  return words.length ? words.map(([, word]) => word).join(' ') : null
}

function isTopJournal(journal: string | null): boolean {
  if (!journal) return false
  const normalized = normalizeKey(journal)
  return TOP_JOURNALS.some((marker) => normalized === marker || normalized.includes(` ${marker} `))
}

const QUERY_STOP_WORDS = new Set([
  'and',
  'the',
  'for',
  'with',
  'this',
  'that',
  'paper',
  'article',
  'study',
])

function queryTokens(query: string): string[] {
  return normalizeKey(query)
    .split(' ')
    .filter((token) => token.length > 2 && !QUERY_STOP_WORDS.has(token))
}

function relevanceScore(result: DevSearchResult, tokens: string[]): number {
  if (tokens.length === 0) return 0

  const title = normalizeKey(result.title)
  const authors = normalizeKey(result.authors.map((author) => author.name).join(' '))
  const haystack = `${title} ${authors}`
  const matched = tokens.filter((token) => haystack.includes(token))
  if (matched.length === 0) return 0

  const titleMatches = matched.filter((token) => title.includes(token)).length
  const authorMatches = matched.filter((token) => authors.includes(token)).length
  return Math.min(85, (matched.length / tokens.length) * 60 + titleMatches * 4 + authorMatches * 5)
}

function scoreResult(result: DevSearchResult, tokens: string[], options: DevSearchOptions): DevSearchResult {
  const tierScore = isTopJournal(result.journal) ? 45 : 0
  const searchScore = relevanceScore(result, tokens)
  const citationScore = Math.log(Math.max(0, result.citation_count) + 1) * 8
  const recencyScore = result.year ? Math.max(0, Math.min(35, result.year - 2000)) * 0.25 : 0
  const publishedAt = publicationTimestamp(result)
  const ageDays = publishedAt ? Math.max(0, (Date.now() - publishedAt) / 86_400_000) : null
  const newestScore = ageDays === null ? 0 : Math.max(0, 120 - Math.min(120, ageDays / 14))
  result.is_top_journal = tierScore > 0
  const metadataScore = (result.abstract_text ? 3 : 0)
    + (result.open_access_pdf_url || result.open_access_url ? 2 : 0)
    + (result.doi ? 2 : 0)
  result.quality_score = options.sortMode === 'newest'
    ? newestScore + searchScore * 0.45 + tierScore * 0.2 + citationScore * 0.15 + metadataScore
    : searchScore + tierScore + citationScore + recencyScore + metadataScore
  return result
}

function resultKey(result: DevSearchResult): string {
  return result.doi ? `doi:${normalizeDoi(result.doi)}` : `title:${normalizeKey(result.title)}`
}

function compareResults(a: DevSearchResult, b: DevSearchResult, options: DevSearchOptions): number {
  if (options.sortMode === 'newest') {
    const aTime = publicationTimestamp(a) ?? 0
    const bTime = publicationTimestamp(b) ?? 0
    if (aTime !== bTime) return bTime - aTime
  }
  return b.quality_score - a.quality_score
}

function mergeResults(results: DevSearchResult[], limit: number, query: string, options: DevSearchOptions): DevSearchResult[] {
  const tokens = queryTokens(query)
  const byKey = new Map<string, DevSearchResult>()
  for (const raw of results.filter((result) => isWithinDateRange(result, options)).map((result) => scoreResult(result, tokens, options))) {
    const key = resultKey(raw)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, raw)
      continue
    }
    if (!existing.abstract_text) existing.abstract_text = raw.abstract_text
    if (!existing.open_access_url) existing.open_access_url = raw.open_access_url
    if (!existing.open_access_pdf_url) existing.open_access_pdf_url = raw.open_access_pdf_url
    if (!existing.open_access_landing_url) existing.open_access_landing_url = raw.open_access_landing_url
    if (!existing.journal) existing.journal = raw.journal
    if (!existing.doi) existing.doi = raw.doi
    if (!existing.published_date) existing.published_date = raw.published_date
    existing.citation_count = Math.max(existing.citation_count, raw.citation_count)
    existing.quality_score = Math.max(existing.quality_score, raw.quality_score)
    existing.is_top_journal ||= raw.is_top_journal
    if (!existing.source.includes(raw.source)) existing.source = `${existing.source} / ${raw.source}`
  }

  return Array.from(byKey.values())
    .sort((a, b) => compareResults(a, b, options))
    .slice(0, limit)
}

async function searchOpenAlex(query: string, limit: number, options: DevSearchOptions): Promise<DevSearchResult[]> {
  const params = new URLSearchParams({
    search: query,
    per_page: String(limit),
    sort: options.sortMode === 'newest' ? 'publication_date:desc' : 'relevance_score:desc',
    mailto: 'zluo5820@gmail.com',
  })
  const filters: string[] = []
  if (options.fromDate) filters.push(`from_publication_date:${options.fromDate}`)
  if (options.untilDate) filters.push(`to_publication_date:${options.untilDate}`)
  if (filters.length > 0) params.set('filter', filters.join(','))
  const url = `https://api.openalex.org/works?${params.toString()}`
  const data = await fetch(url).then((res) => res.json()) as { results?: OpenAlexWork[] }
  return (data.results ?? []).flatMap((work) => {
    if (!work.title) return []
    const journal = work.primary_location?.source?.display_name
      ?? work.best_oa_location?.source?.display_name
      ?? null
    const openAccessPdfUrl = work.primary_location?.pdf_url
      ?? work.best_oa_location?.pdf_url
      ?? null
    const openAccessLandingUrl = work.open_access?.oa_url
      ?? work.best_oa_location?.landing_page_url
      ?? work.primary_location?.landing_page_url
      ?? null
    const sourceUrl = work.primary_location?.landing_page_url
      ?? work.open_access?.oa_url
      ?? work.id
      ?? ''
    return [{
      id: work.id ?? '',
      title: work.title,
      abstract_text: reconstructAbstract(work.abstract_inverted_index),
      authors: (work.authorships ?? [])
        .map((a) => a.author?.display_name)
        .filter((name): name is string => Boolean(name))
        .map((name) => ({ name })),
      year: work.publication_year ?? null,
      citation_count: work.cited_by_count ?? 0,
      open_access_url: openAccessPdfUrl,
      open_access_pdf_url: openAccessPdfUrl,
      open_access_landing_url: openAccessLandingUrl,
      source_url: sourceUrl,
      source: 'OpenAlex',
      journal,
      doi: work.doi ?? null,
      published_date: work.publication_date ?? dateFromYear(work.publication_year ?? null),
      is_top_journal: false,
      quality_score: 0,
    }]
  })
}

async function searchSemanticScholar(query: string, limit: number, options: DevSearchOptions): Promise<DevSearchResult[]> {
  const fields = 'paperId,title,abstract,year,publicationDate,citationCount,authors,url,openAccessPdf,venue,journal,externalIds'
  const params = new URLSearchParams({ query, limit: String(limit), fields })
  if (options.fromDate || options.untilDate) {
    params.set('publicationDateOrYear', `${options.fromDate ?? ''}:${options.untilDate ?? ''}`)
  }
  if (options.sortMode === 'newest') params.set('sort', 'publicationDate:desc')
  const url = `https://api.semanticscholar.org/graph/v1/paper/search/bulk?${params.toString()}`
  const data = await fetch(url).then((res) => res.json()) as { data?: SemanticPaper[] }
  return (data.data ?? []).flatMap((paper) => {
    if (!paper.title) return []
    const openAccessPdfUrl = paper.openAccessPdf?.url ?? null
    const sourceUrl = paper.url ?? (paper.paperId ? `https://www.semanticscholar.org/paper/${paper.paperId}` : '')
    return [{
      id: paper.paperId ?? '',
      title: paper.title,
      abstract_text: paper.abstract ?? null,
      authors: (paper.authors ?? [])
        .map((a) => a.name)
        .filter((name): name is string => Boolean(name))
        .map((name) => ({ name })),
      year: paper.year ?? null,
      citation_count: paper.citationCount ?? 0,
      open_access_url: openAccessPdfUrl,
      open_access_pdf_url: openAccessPdfUrl,
      open_access_landing_url: sourceUrl || null,
      source_url: sourceUrl,
      source: 'Semantic Scholar',
      journal: paper.journal?.name ?? paper.venue ?? null,
      doi: paper.externalIds?.DOI ?? null,
      published_date: paper.publicationDate ?? dateFromYear(paper.year ?? null),
      is_top_journal: false,
      quality_score: 0,
    }]
  })
}

function crossrefYear(work: CrossrefWork): number | null {
  const publishedDate = crossrefPublishedDate(work)
  return publishedDate ? Number(publishedDate.slice(0, 4)) : null
}

async function searchCrossref(query: string, limit: number, options: DevSearchOptions): Promise<DevSearchResult[]> {
  const filters = ['type:journal-article']
  if (options.fromDate) filters.push(`from-pub-date:${options.fromDate}`)
  if (options.untilDate) filters.push(`until-pub-date:${options.untilDate}`)
  const params = new URLSearchParams({
    'query.bibliographic': query,
    rows: String(limit),
    filter: filters.join(','),
    mailto: 'zluo5820@gmail.com',
  })
  if (options.sortMode === 'newest') {
    params.set('sort', 'published')
    params.set('order', 'desc')
  }
  const url = `https://api.crossref.org/works?${params.toString()}`
  const data = await fetch(url).then((res) => res.json()) as { message?: { items?: CrossrefWork[] } }
  return (data.message?.items ?? []).flatMap((work) => {
    const title = work.title?.[0]?.trim()
    if (!title) return []
    const doi = work.DOI ?? null
    return [{
      id: doi ?? work.URL ?? '',
      title,
      abstract_text: work.abstract ? stripMarkup(work.abstract) : null,
      authors: (work.author ?? []).map((author) => ({
        name: author.name ?? [author.given, author.family].filter(Boolean).join(' '),
      })).filter((author) => author.name),
      year: crossrefYear(work),
      citation_count: work['is-referenced-by-count'] ?? 0,
      open_access_url: null,
      open_access_pdf_url: null,
      open_access_landing_url: null,
      source_url: work.URL ?? (doi ? `https://doi.org/${doi}` : ''),
      source: 'Crossref',
      journal: work['container-title']?.[0] ?? null,
      doi,
      published_date: crossrefPublishedDate(work),
      is_top_journal: false,
      quality_score: 0,
    }]
  })
}

function pickXmlText(entry: string, tag: string): string {
  return decodeXml(entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))?.[1] ?? '')
}

function parseArxivXml(xml: string): DevSearchResult[] {
  return Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)).flatMap((match) => {
    const entry = match[1]
    const title = pickXmlText(entry, 'title')
    if (!title) return []
    const id = pickXmlText(entry, 'id')
    const published = pickXmlText(entry, 'published')
    const pdf = entry.match(/<link[^>]+title="pdf"[^>]+href="([^"]+)"/i)?.[1] ?? null
    const authors = Array.from(entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g))
      .map((author) => ({ name: decodeXml(author[1]) }))
    return [{
      id,
      title,
      abstract_text: pickXmlText(entry, 'summary') || null,
      authors,
      year: published.slice(0, 4) ? Number(published.slice(0, 4)) : null,
      citation_count: 0,
      open_access_url: pdf,
      open_access_pdf_url: pdf,
      open_access_landing_url: id || null,
      source_url: id,
      source: 'arXiv',
      journal: 'arXiv',
      doi: null,
      published_date: published.slice(0, 10) || null,
      is_top_journal: false,
      quality_score: 0,
    }]
  })
}

function parseArxivTotalResults(xml: string): number {
  const match = xml.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/i)
  return match ? Number(match[1]) : 0
}

async function searchArxiv(query: string, limit: number, options: DevSearchOptions): Promise<DevSearchResult[]> {
  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: '0',
    max_results: String(limit),
    sortBy: options.sortMode === 'newest' ? 'submittedDate' : 'relevance',
  })
  if (options.sortMode === 'newest') params.set('sortOrder', 'descending')
  const url = `https://export.arxiv.org/api/query?${params.toString()}`
  const xml = await fetch(url).then((res) => res.text())
  return parseArxivXml(xml).filter((result) => isWithinDateRange(result, options))
}

async function searchArxivFeed(
  categories: string[],
  fromDate: string,
  untilDate: string,
  limit: number,
): Promise<{ totalAvailable: number; results: DevSearchResult[] }> {
  const searchQuery = `(${categories.map((category) => `cat:${category}`).join(' OR ')}) AND submittedDate:[${compactDateForArxiv(fromDate, false)} TO ${compactDateForArxiv(untilDate, true)}]`
  const requested = Math.max(1, Math.min(200, limit))
  const pageSize = 100
  let start = 0
  let totalAvailable = 0
  const results: DevSearchResult[] = []

  while (results.length < requested) {
    const params = new URLSearchParams({
      search_query: searchQuery,
      start: String(start),
      max_results: String(Math.min(pageSize, requested - results.length)),
      sortBy: 'submittedDate',
      sortOrder: 'descending',
    })
    const xml = await fetch(`https://export.arxiv.org/api/query?${params.toString()}`).then((res) => res.text())
    if (totalAvailable === 0) totalAvailable = parseArxivTotalResults(xml)
    const page = parseArxivXml(xml)
    if (page.length === 0) break
    results.push(...page)
    start += page.length
  }

  return { totalAvailable, results }
}

async function searchDevPapers(query: string, limit: number, rawOptions: DevSearchOptions): Promise<{
  total: number
  results: DevSearchResult[]
  mode?: DevSearchOptions['searchMode']
  totalAvailable?: number
  fetched?: number
  categories?: string[]
  fromDate?: string
  untilDate?: string
}> {
  const options = cleanSearchOptions(rawOptions)
  if (options.searchMode === 'recent_ai_feed' || options.searchMode === 'arxiv_category_feed') {
    const categories = arxivCategoriesForOptions(options)
    const fromDate = options.fromDate ?? '1970-01-01'
    const untilDate = options.untilDate ?? new Date().toISOString().slice(0, 10)
    const feed = await searchArxivFeed(categories, fromDate, untilDate, options.feedLimit ?? limit)
    const tokens = queryTokens(query)
    const results = feed.results.map((result) => scoreResult(result, tokens, options))
    return {
      total: results.length,
      results,
      mode: options.searchMode,
      totalAvailable: feed.totalAvailable,
      fetched: results.length,
      categories,
      fromDate,
      untilDate,
    }
  }

  const perSource = Math.max(4, Math.min(15, Math.ceil(limit / 4)))
  const batches = await Promise.allSettled([
    searchOpenAlex(query, perSource, options),
    searchArxiv(query, perSource, options),
    searchSemanticScholar(query, perSource, options),
    searchCrossref(query, perSource, options),
  ])
  const results = mergeResults(
    batches.flatMap((batch) => batch.status === 'fulfilled' ? batch.value : []),
    limit,
    query,
    options,
  )
  return {
    total: results.length,
    results,
    mode: options.searchMode,
    fetched: results.length,
    fromDate: options.fromDate,
    untilDate: options.untilDate,
  }
}

async function handleSearchPapers(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (req.method !== 'GET' || !req.url) {
    next()
    return
  }

  try {
    const url = new URL(req.url, 'http://localhost')
    const query = url.searchParams.get('query')?.trim()
    const limit = Math.max(4, Math.min(40, Number(url.searchParams.get('limit') ?? 12)))
    const options = cleanSearchOptions({
      fromDate: url.searchParams.get('fromDate') ?? undefined,
      untilDate: url.searchParams.get('untilDate') ?? undefined,
      sortMode: (url.searchParams.get('sortMode') ?? undefined) as DevSearchOptions['sortMode'],
      searchMode: (url.searchParams.get('searchMode') ?? undefined) as DevSearchOptions['searchMode'],
      sourceHint: (url.searchParams.get('sourceHint') ?? undefined) as DevSearchOptions['sourceHint'],
      categoryPreset: (url.searchParams.get('categoryPreset') ?? undefined) as DevSearchOptions['categoryPreset'],
      arxivCategories: url.searchParams.get('arxivCategories')?.split(',').map((category) => category.trim()).filter(Boolean),
      feedLimit: url.searchParams.get('feedLimit') ? Number(url.searchParams.get('feedLimit')) : undefined,
      includeTotalCount: url.searchParams.get('includeTotalCount') === 'true' ? true : undefined,
    })
    if (!query) {
      res.statusCode = 400
      res.end('Missing query')
      return
    }

    const response = await searchDevPapers(query, limit, options)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(response))
  } catch (error) {
    res.statusCode = 500
    res.end(error instanceof Error ? error.message : String(error))
  }
}

async function handlePaperPreviewPdf(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (req.method !== 'GET' || !req.url) {
    next()
    return
  }

  try {
    const parsed = new URL(req.url, 'http://localhost')
    const target = parsed.searchParams.get('url')?.trim()
    if (!target || (!target.startsWith('https://') && !target.startsWith('http://'))) {
      res.statusCode = 400
      res.end('Missing or invalid PDF URL')
      return
    }
    if (blockedPublicUrl(target)) {
      res.statusCode = 451
      res.end('Blocked source')
      return
    }

    const response = await fetch(target, {
      headers: { 'User-Agent': 'Lumen/0.1 paper-preview' },
    })
    if (!response.ok) {
      res.statusCode = response.status
      res.end(`PDF fetch failed: HTTP ${response.status}`)
      return
    }

    const length = Number(response.headers.get('content-length') ?? 0)
    if (length > MAX_PREVIEW_PDF_BYTES) {
      res.statusCode = 413
      res.end('PDF exceeds 50MB preview limit')
      return
    }

    const bytes = new Uint8Array(await response.arrayBuffer())
    const sample = bytes.slice(0, Math.min(bytes.byteLength, 1024))
    const looksLikePdf = Array.from({ length: Math.max(0, sample.byteLength - 3) })
      .some((_, index) => (
        sample[index] === 0x25
        && sample[index + 1] === 0x50
        && sample[index + 2] === 0x44
        && sample[index + 3] === 0x46
      ))
    if (bytes.byteLength > MAX_PREVIEW_PDF_BYTES) {
      res.statusCode = 413
      res.end('PDF exceeds 50MB preview limit')
      return
    }
    if (!looksLikePdf) {
      res.statusCode = 415
      res.end('Response does not look like a PDF')
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/pdf')
    res.end(Buffer.from(bytes))
  } catch (error) {
    res.statusCode = 500
    res.end(error instanceof Error ? error.message : String(error))
  }
}

async function handlePaperPreviewHtml(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (req.method !== 'GET' || !req.url) {
    next()
    return
  }

  try {
    const parsed = new URL(req.url, 'http://localhost')
    const target = parsed.searchParams.get('url')?.trim()
    if (!target || (!target.startsWith('https://') && !target.startsWith('http://'))) {
      res.statusCode = 400
      res.end('Missing or invalid URL')
      return
    }
    if (blockedPublicUrl(target)) {
      res.statusCode = 451
      res.end('Blocked source')
      return
    }

    const response = await fetch(target, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Lumen/0.1 pdf-resolver' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) {
      res.statusCode = response.status
      res.end(`HTML fetch failed: HTTP ${response.status}`)
      return
    }
    if (blockedPublicUrl(response.url)) {
      res.statusCode = 451
      res.end('Blocked redirected source')
      return
    }

    const length = Number(response.headers.get('content-length') ?? 0)
    if (length > MAX_PUBLIC_HTML_BYTES) {
      res.statusCode = 413
      res.end('HTML exceeds 2MB resolver limit')
      return
    }

    const html = await response.text()
    if (html.length > MAX_PUBLIC_HTML_BYTES) {
      res.statusCode = 413
      res.end('HTML exceeds 2MB resolver limit')
      return
    }

    writeJson(res, 200, {
      url: response.url,
      content_type: response.headers.get('content-type'),
      html,
    })
  } catch (error) {
    res.statusCode = 500
    res.end(error instanceof Error ? error.message : String(error))
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      body += chunk
      if (body.length > 2_000_000) {
        reject(new Error('Request body is too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function writeJson(res: ServerResponse, status: number, value: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(value))
}

function buildDevOpenAIMessages(messages: DevChatMessage[]): unknown[] {
  return messages.map((message) => {
    if (message.images?.length) {
      const content: unknown[] = [{ type: 'text', text: message.content }]
      for (const image of message.images) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${image.mediaType};base64,${image.base64}` },
        })
      }
      return { role: message.role, content }
    }
    return { role: message.role, content: message.content }
  })
}

function buildDevAnthropicMessages(messages: DevChatMessage[]): unknown[] {
  return messages.filter((message) => message.role !== 'system').map((message) => {
    if (message.images?.length) {
      const content: unknown[] = []
      for (const image of message.images) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
        })
      }
      content.push({ type: 'text', text: message.content })
      return { role: message.role, content }
    }
    return { role: message.role, content: message.content }
  })
}

async function callDevOpenAICompat(request: DevAiChatRequest, endpoint: string): Promise<string> {
  const model = request.model?.trim()
  if (!model) throw new Error('Missing model')

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${request.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: buildDevOpenAIMessages(request.messages ?? []),
      ...(typeof request.temperature === 'number' ? { temperature: request.temperature } : {}),
      ...(typeof request.maxTokens === 'number' ? { max_tokens: request.maxTokens } : {}),
      ...(request.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  if (!response.ok) {
    throw new Error(await response.text().catch(() => `HTTP ${response.status}`))
  }

  const data = await response.json() as DevOpenAIResponse
  return data.choices?.[0]?.message?.content ?? ''
}

async function callDevAnthropic(request: DevAiChatRequest): Promise<string> {
  const model = request.model?.trim()
  if (!model) throw new Error('Missing model')

  const systemMessage = request.messages?.find((message) => message.role === 'system')
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': request.apiKey ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: request.maxTokens ?? 4096,
      system: systemMessage?.content,
      messages: buildDevAnthropicMessages(request.messages ?? []),
    }),
  })

  if (!response.ok) {
    throw new Error(await response.text().catch(() => `HTTP ${response.status}`))
  }

  const data = await response.json() as DevAnthropicResponse
  return data.content?.[0]?.text ?? ''
}

async function handleAiChat(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (req.method !== 'POST') {
    next()
    return
  }

  try {
    const request = JSON.parse(await readBody(req)) as DevAiChatRequest
    if (!request.provider || !request.apiKey || !Array.isArray(request.messages)) {
      writeJson(res, 400, { error: 'Missing provider, apiKey, or messages' })
      return
    }

    let content: string
    if (request.provider === 'anthropic') {
      content = await callDevAnthropic(request)
    } else if (request.provider === 'openai') {
      content = await callDevOpenAICompat(request, 'https://api.openai.com/v1/chat/completions')
    } else if (request.provider === 'deepseek') {
      content = await callDevOpenAICompat(request, 'https://api.deepseek.com/chat/completions')
    } else if (request.provider === 'custom' && request.endpoint) {
      content = await callDevOpenAICompat(request, request.endpoint)
    } else {
      writeJson(res, 400, { error: `Unsupported AI provider: ${request.provider}` })
      return
    }

    writeJson(res, 200, { content })
  } catch (error) {
    writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
  }
}

function devSearchApiPlugin(): Plugin {
  return {
    name: 'lumen-dev-search-api',
    configureServer(server) {
      server.middlewares.use('/api/search-papers', handleSearchPapers)
      server.middlewares.use('/api/paper-preview/pdf', handlePaperPreviewPdf)
      server.middlewares.use('/api/paper-preview/html', handlePaperPreviewHtml)
      server.middlewares.use('/api/ai/chat', handleAiChat)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devSearchApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
})
