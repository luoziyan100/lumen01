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
  source_url: string
  source: string
  journal: string | null
  doi: string | null
  is_top_journal: boolean
  quality_score: number
}

interface OpenAlexWork {
  id?: string
  title?: string
  doi?: string
  authorships?: Array<{ author?: { display_name?: string } }>
  publication_year?: number
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
  messages?: DevChatMessage[]
}

interface DevOpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>
}

interface DevAnthropicResponse {
  content?: Array<{ text?: string }>
}

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
]

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

function scoreResult(result: DevSearchResult, tokens: string[]): DevSearchResult {
  const tierScore = isTopJournal(result.journal) ? 45 : 0
  const searchScore = relevanceScore(result, tokens)
  const citationScore = Math.log(Math.max(0, result.citation_count) + 1) * 8
  const recencyScore = result.year ? Math.max(0, Math.min(35, result.year - 2000)) * 0.25 : 0
  result.is_top_journal = tierScore > 0
  result.quality_score = searchScore
    + tierScore
    + citationScore
    + recencyScore
    + (result.abstract_text ? 3 : 0)
    + (result.open_access_url ? 2 : 0)
    + (result.doi ? 2 : 0)
  return result
}

function resultKey(result: DevSearchResult): string {
  return result.doi ? `doi:${normalizeDoi(result.doi)}` : `title:${normalizeKey(result.title)}`
}

function mergeResults(results: DevSearchResult[], limit: number, query: string): DevSearchResult[] {
  const tokens = queryTokens(query)
  const byKey = new Map<string, DevSearchResult>()
  for (const raw of results.map((result) => scoreResult(result, tokens))) {
    const key = resultKey(raw)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, raw)
      continue
    }
    if (!existing.abstract_text) existing.abstract_text = raw.abstract_text
    if (!existing.open_access_url) existing.open_access_url = raw.open_access_url
    if (!existing.journal) existing.journal = raw.journal
    if (!existing.doi) existing.doi = raw.doi
    existing.citation_count = Math.max(existing.citation_count, raw.citation_count)
    existing.quality_score = Math.max(existing.quality_score, raw.quality_score)
    existing.is_top_journal ||= raw.is_top_journal
    if (!existing.source.includes(raw.source)) existing.source = `${existing.source} / ${raw.source}`
  }

  return Array.from(byKey.values())
    .sort((a, b) => b.quality_score - a.quality_score)
    .slice(0, limit)
}

async function searchOpenAlex(query: string, limit: number): Promise<DevSearchResult[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=${limit}&sort=relevance_score:desc&mailto=zluo5820@gmail.com`
  const data = await fetch(url).then((res) => res.json()) as { results?: OpenAlexWork[] }
  return (data.results ?? []).flatMap((work) => {
    if (!work.title) return []
    const journal = work.primary_location?.source?.display_name
      ?? work.best_oa_location?.source?.display_name
      ?? null
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
      open_access_url: work.open_access?.oa_url
        ?? work.best_oa_location?.pdf_url
        ?? work.best_oa_location?.landing_page_url
        ?? null,
      source_url: work.primary_location?.landing_page_url ?? work.id ?? '',
      source: 'OpenAlex',
      journal,
      doi: work.doi ?? null,
      is_top_journal: false,
      quality_score: 0,
    }]
  })
}

async function searchSemanticScholar(query: string, limit: number): Promise<DevSearchResult[]> {
  const fields = 'paperId,title,abstract,year,citationCount,authors,url,openAccessPdf,venue,journal,externalIds'
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`
  const data = await fetch(url).then((res) => res.json()) as { data?: SemanticPaper[] }
  return (data.data ?? []).flatMap((paper) => {
    if (!paper.title) return []
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
      open_access_url: paper.openAccessPdf?.url ?? null,
      source_url: paper.url ?? (paper.paperId ? `https://www.semanticscholar.org/paper/${paper.paperId}` : ''),
      source: 'Semantic Scholar',
      journal: paper.journal?.name ?? paper.venue ?? null,
      doi: paper.externalIds?.DOI ?? null,
      is_top_journal: false,
      quality_score: 0,
    }]
  })
}

function crossrefYear(work: CrossrefWork): number | null {
  return work['published-print']?.['date-parts']?.[0]?.[0]
    ?? work['published-online']?.['date-parts']?.[0]?.[0]
    ?? work.published?.['date-parts']?.[0]?.[0]
    ?? null
}

async function searchCrossref(query: string, limit: number): Promise<DevSearchResult[]> {
  const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=${limit}&filter=type:journal-article&mailto=zluo5820@gmail.com`
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
      source_url: work.URL ?? (doi ? `https://doi.org/${doi}` : ''),
      source: 'Crossref',
      journal: work['container-title']?.[0] ?? null,
      doi,
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
      source_url: id,
      source: 'arXiv',
      journal: 'arXiv',
      doi: null,
      is_top_journal: false,
      quality_score: 0,
    }]
  })
}

async function searchArxiv(query: string, limit: number): Promise<DevSearchResult[]> {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}&sortBy=relevance`
  const xml = await fetch(url).then((res) => res.text())
  return parseArxivXml(xml)
}

async function searchDevPapers(query: string, limit: number): Promise<DevSearchResult[]> {
  const perSource = Math.max(4, Math.min(15, Math.ceil(limit / 4)))
  const batches = await Promise.allSettled([
    searchOpenAlex(query, perSource),
    searchArxiv(query, perSource),
    searchSemanticScholar(query, perSource),
    searchCrossref(query, perSource),
  ])
  return mergeResults(
    batches.flatMap((batch) => batch.status === 'fulfilled' ? batch.value : []),
    limit,
    query,
  )
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
    if (!query) {
      res.statusCode = 400
      res.end('Missing query')
      return
    }

    const results = await searchDevPapers(query, limit)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ total: results.length, results }))
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
      max_tokens: 4096,
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
