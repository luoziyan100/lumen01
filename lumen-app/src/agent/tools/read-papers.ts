import type { PaperPreviewData } from '../../services/paper-preview.ts'
import type { SearchResult } from '../../services/search.ts'
import type { AgentMessage } from '../adapters/types.ts'

export interface ReadPapersResult {
  papers: Array<{
    title: string
    evidence_level: 'pdf_text' | 'abstract_only' | 'metadata_only'
    text: string
    warning?: string
  }>
  warning?: string
}

export interface ReadPapersContext {
  conversationHistory: AgentMessage[]
  previewPaper?: (paper: SearchResult, signal?: AbortSignal) => Promise<PaperPreviewData>
}

interface RequestedPaper {
  title?: unknown
  doi?: unknown
  url?: unknown
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/^https?:\/\/doi\.org\//, '').replace(/^doi:/, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function scoreTitle(wanted: string, candidate: string): number {
  const wantedTokens = new Set(normalize(wanted).split(' ').filter(Boolean))
  const candidateTokens = new Set(normalize(candidate).split(' ').filter(Boolean))
  if (!wantedTokens.size || !candidateTokens.size) return 0
  let overlap = 0
  for (const token of wantedTokens) if (candidateTokens.has(token)) overlap += 1
  return overlap / Math.max(wantedTokens.size, candidateTokens.size)
}

function minimalPaper(input: { title: string; doi?: string; url?: string; abstract?: string | null }): SearchResult {
  const url = input.url ?? (input.doi ? `https://doi.org/${input.doi}` : '')
  return {
    id: `external-${normalize(input.doi ?? input.title) || Date.now()}`,
    title: input.title,
    abstract_text: input.abstract ?? null,
    authors: [],
    year: null,
    citation_count: 0,
    open_access_url: url || null,
    open_access_pdf_url: url.toLowerCase().endsWith('.pdf') ? url : null,
    open_access_landing_url: url || null,
    source_url: url,
    source: 'conversation',
    journal: null,
    doi: input.doi ?? null,
    published_date: null,
    is_top_journal: false,
    quality_score: 0,
  }
}

function papersFromToolResults(messages: AgentMessage[]): SearchResult[] {
  const papers: SearchResult[] = []
  for (const message of messages) {
    if (message.role !== 'tool_result') continue
    try {
      const parsed = JSON.parse(message.content) as { results?: Array<Record<string, unknown>> }
      for (const result of parsed.results ?? []) {
        if (typeof result.title !== 'string') continue
        papers.push(minimalPaper({
          title: result.title,
          doi: typeof result.doi === 'string' ? result.doi : undefined,
          url: typeof result.open_access_url === 'string'
            ? result.open_access_url
            : typeof result.source_url === 'string'
              ? result.source_url
              : undefined,
          abstract: typeof result.abstract_snippet === 'string' ? result.abstract_snippet : null,
        }))
      }
    } catch {
      // Ignore non-search tool results.
    }
  }
  return papers
}

function resolveRequestedPaper(request: RequestedPaper, candidates: SearchResult[]): SearchResult {
  const title = typeof request.title === 'string' ? request.title : 'Untitled paper'
  const doi = typeof request.doi === 'string' ? request.doi : undefined
  const url = typeof request.url === 'string' ? request.url : undefined
  if (doi) {
    const wanted = normalize(doi)
    const match = candidates.find((paper) => paper.doi && normalize(paper.doi) === wanted)
    if (match) return match
  }
  if (url) {
    const match = candidates.find((paper) => [paper.source_url, paper.open_access_url, paper.open_access_pdf_url, paper.open_access_landing_url].includes(url))
    if (match) return match
  }
  const best = candidates
    .map((paper) => ({ paper, score: scoreTitle(title, paper.title) }))
    .sort((a, b) => b.score - a.score)[0]
  if (best && best.score >= 0.35) return best.paper
  return minimalPaper({ title, doi, url })
}

function evidenceLevel(preview: PaperPreviewData): ReadPapersResult['papers'][number]['evidence_level'] {
  if (preview.evidenceLevel === 'pdf_text_preview') return 'pdf_text'
  if (preview.evidenceLevel === 'abstract_only') return 'abstract_only'
  return 'metadata_only'
}

async function defaultPreviewPaper(paper: SearchResult, signal?: AbortSignal): Promise<PaperPreviewData> {
  const { previewSearchResultPaper } = await import('../../services/paper-preview.ts')
  return previewSearchResultPaper(paper, signal)
}

export async function executeReadPapers(
  rawArgs: Record<string, unknown>,
  context: ReadPapersContext,
  signal?: AbortSignal,
): Promise<ReadPapersResult> {
  const rawPapers = Array.isArray(rawArgs.papers) ? rawArgs.papers as RequestedPaper[] : []
  const requested = rawPapers.slice(0, 5)
  const candidates = papersFromToolResults(context.conversationHistory)
  const preview = context.previewPaper ?? defaultPreviewPaper
  const papers: ReadPapersResult['papers'] = []

  for (const request of requested) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const paper = resolveRequestedPaper(request, candidates)
    const previewData = await preview(paper, signal)
    papers.push({
      title: previewData.paper.title,
      evidence_level: evidenceLevel(previewData),
      text: previewData.text,
      warning: previewData.message,
    })
  }

  return {
    papers,
    warning: rawPapers.length > 5 ? '一次最多读取 5 篇，已截断后续论文。' : undefined,
  }
}
