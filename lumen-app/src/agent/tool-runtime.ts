/**
 * [INPUT]: 依赖 SearchPlan
 * [OUTPUT]: 对外提供 ToolEvidenceBundle 构造器和后续工具运行时边界
 * [POS]: agent pipeline 的 Tool Runtime 层，负责把 decision 转为标准 evidence bundle
 */
import type { PaperPreviewData } from '../services/paper-preview.ts'
import type { SearchResult } from '../services/search.ts'
import type { PaperJudgmentInput, ResearchJudgmentReportInput } from './research-judgment.ts'
import type {
  AgentToolName,
  CurrentPaperEvidenceLevel,
  DeepResearchReportArtifact,
  PaperEvidenceNote,
  SearchBatch,
  SearchPlan,
  SearchReflection,
  SearchResultSet,
  ToolResult,
  ToolEvidenceBundle,
} from './types.ts'

export interface AcademicSearchEvidenceBundleInput {
  batches: SearchBatch[]
  searchResults: SearchResult[]
  searchResultSet?: SearchResultSet
  evidence?: PaperEvidenceNote[]
  warnings?: string[]
}

export interface DeepResearchEvidenceBundleInput {
  batches?: SearchBatch[]
  searchResults: SearchResult[]
  searchResultSet?: SearchResultSet
  evidence: PaperEvidenceNote[]
  deepResearchReport?: DeepResearchReportArtifact
  warnings?: string[]
}

export type PaperPreviewer = (
  paper: SearchResult,
  signal?: AbortSignal,
) => Promise<PaperPreviewData>

export type PaperDetailFormatter = (paper: SearchResult) => Promise<string> | string
export type LocalPaperContextLoader = (query: string) => Promise<string>

export type ResearchJudgmentPreviewer = PaperPreviewer

export interface CreateSearchResultSetInput {
  userText: string
  nextSearchResultSetLabel?: string
  plan: SearchPlan
  batches: SearchBatch[]
  results: SearchResult[]
  now?: () => string
  createId?: () => string
}

export interface BuildDeepResearchReportArtifactOptions {
  resultSetId?: string
  indices?: number[]
  now?: () => string
}

export interface RunAcademicSearchToolInput {
  userText: string
  plan: SearchPlan
  search: (plan: SearchPlan, phase: 'initial' | 'retry') => Promise<ToolResult<SearchBatch[]>>
  reflect: (userText: string, plan: SearchPlan, batches: SearchBatch[]) => Promise<SearchReflection>
  merge: (batches: SearchBatch[], limit: number) => SearchResult[]
  resultLimit?: number
}

export interface AcademicSearchToolOutput {
  batches: SearchBatch[]
  reflection: SearchReflection
  searchResults: SearchResult[]
}

function defaultResultSetId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `rs-${random}`
}

function evidenceSourceForPreview(preview: PaperPreviewData): PaperEvidenceNote['evidenceSource'] {
  if (preview.evidenceLevel === 'pdf_text_preview') return 'pdf_text'
  if (preview.evidenceLevel === 'abstract_only') return 'abstract'
  return preview.message ? 'download_failed' : 'metadata'
}

export async function previewPapersAsEvidence(
  papers: SearchResult[],
  previewer: PaperPreviewer,
  signal?: AbortSignal,
): Promise<PaperEvidenceNote[]> {
  const notes: PaperEvidenceNote[] = []
  for (const paper of papers) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    notes.push(createEvidenceNoteFromPreview(await previewer(paper, signal)))
  }
  return notes
}

export function createSearchResultSetFromBatches(input: CreateSearchResultSetInput): SearchResultSet {
  const primaryBatch = input.batches.find((batch) => batch.mode === 'recent_ai_feed' || batch.mode === 'arxiv_category_feed') ?? input.batches[0]
  const categories = Array.from(new Set(input.batches.flatMap((batch) => batch.categories ?? [])))
  const totalAvailable = primaryBatch?.totalAvailable
    ?? (input.batches.length > 0 ? input.batches.reduce((sum, batch) => sum + batch.total, 0) : undefined)
  const fetched = input.batches.length > 0
    ? input.batches.reduce((sum, batch) => sum + (batch.fetched ?? batch.results.length), 0)
    : input.results.length

  return {
    id: input.createId?.() ?? defaultResultSetId(),
    label: input.nextSearchResultSetLabel ?? 'R1',
    query: input.userText,
    plan: input.plan,
    mode: primaryBatch?.mode ?? input.plan.searchMode,
    totalAvailable,
    fetched,
    categories: categories.length > 0 ? categories : undefined,
    fromDate: primaryBatch?.fromDate ?? input.plan.timeRange?.fromDate,
    untilDate: primaryBatch?.untilDate ?? input.plan.timeRange?.untilDate,
    results: input.results,
    createdAt: input.now?.() ?? new Date().toISOString(),
  }
}

export function buildDeepResearchReportArtifact(
  query: string,
  notes: PaperEvidenceNote[],
  options: BuildDeepResearchReportArtifactOptions = {},
): DeepResearchReportArtifact {
  return {
    query,
    papers: notes.map((note, index) => ({
      paper: note.paper,
      title: note.paper.title,
      doi: note.paper.doi,
      source: note.paper.source,
      sourceResultSetId: options.resultSetId,
      sourceResultIndex: options.indices?.[index],
      evidenceLevel: note.evidenceLevel,
      cacheHit: note.cacheHit,
      pdfCacheHit: note.pdfCacheHit,
      warning: note.warning,
    })),
    createdAt: options.now?.() ?? new Date().toISOString(),
  }
}

export async function runAcademicSearchTool(input: RunAcademicSearchToolInput): Promise<AcademicSearchToolOutput> {
  const searchResult = await input.search(input.plan, 'initial')
  if (!searchResult.ok || !searchResult.data) {
    throw new Error(searchResult.error ?? '学术搜索失败')
  }

  let batches = searchResult.data
  let reflection = await input.reflect(input.userText, input.plan, batches)

  if (reflection.status === 'retry' && reflection.revisedQueries.length > 0) {
    const retryPlan = { ...input.plan, queries: reflection.revisedQueries, sortMode: 'newest' as const }
    const retryResult = await input.search(retryPlan, 'retry')
    if (!retryResult.ok || !retryResult.data) {
      throw new Error(retryResult.error ?? '重试搜索失败')
    }
    batches = [...batches, ...retryResult.data]
    reflection = {
      ...reflection,
      status: retryResult.data.some((batch) => batch.results.length > 0) ? 'sufficient' : 'not_found',
    }
  }

  return {
    batches,
    reflection,
    searchResults: input.merge(batches, input.resultLimit ?? 12),
  }
}

function createEvidenceNoteFromPreview(preview: PaperPreviewData): PaperEvidenceNote {
  return {
    paper: preview.paper,
    evidenceLevel: preview.evidenceLevel,
    text: preview.text,
    cacheHit: preview.cacheHit,
    pdfCacheHit: preview.pdfCacheHit,
    evidenceSource: evidenceSourceForPreview(preview),
    pdfUrl: preview.pdfResolution?.pdfUrl ?? preview.paper.open_access_pdf_url ?? preview.paper.open_access_url,
    pdfTempPath: preview.pdfResolution?.pdfCachePath ?? null,
    warning: preview.message,
  }
}

function evidenceLevelForPaperDetail(paper: SearchResult): CurrentPaperEvidenceLevel {
  return paper.abstract_text ? 'abstract_only' : 'metadata_only'
}

export function formatPaperPreviewToolText(preview: PaperPreviewData): string {
  return `证据来源：${preview.evidenceLevel}
临时文本缓存命中：${preview.cacheHit ? '是' : '否'}
临时 PDF 缓存命中：${preview.pdfCacheHit ? '是' : '否'}
边界：paper_preview 只做临时读取，不会加入文献库。
${preview.message ? `降级说明：${preview.message}\n` : ''}
${preview.text}`
}

export function createNoToolEvidenceBundle(plan: SearchPlan): ToolEvidenceBundle {
  return {
    toolName: 'direct_answer',
    plan,
    toolResults: [],
    evidence: [],
    searchBatches: [],
    searchResults: [],
    replyOverride: plan.response,
    warnings: [],
  }
}

export function createReplyOverrideEvidenceBundle(
  toolName: AgentToolName,
  plan: SearchPlan,
  reply: string,
): ToolEvidenceBundle {
  return {
    toolName,
    plan,
    toolResults: [{ type: 'generic', title: toolName, text: reply }],
    evidence: [],
    searchBatches: [],
    searchResults: [],
    replyOverride: reply,
    warnings: [],
  }
}

export function formatResultSetLinks(
  label: string,
  papers: SearchResult[],
  indices: number[],
): string {
  const lines = papers.map((paper, idx) => {
    const number = indices[idx] ?? idx + 1
    const pdfUrl = paper.open_access_pdf_url ?? paper.open_access_url
    const doi = paper.doi ? `\n   DOI: ${paper.doi}` : ''
    const pdf = pdfUrl ? `\n   PDF: ${pdfUrl}` : ''
    return `**${label}-${number}. ${paper.title}**\n   来源: ${paper.source_url || '无'}${pdf}${doi}`
  })
  return `这是 ${label} 中你引用的论文链接：\n\n${lines.join('\n\n')}`
}

export function createResultSetLinksEvidenceBundle(
  plan: SearchPlan,
  label: string,
  papers: SearchResult[],
  indices: number[],
  searchResults: SearchResult[] = papers,
): ToolEvidenceBundle {
  const reply = formatResultSetLinks(label, papers, indices)
  return {
    toolName: 'paper_detail',
    plan,
    toolResults: [{ type: 'paper_detail', text: reply }],
    evidence: [],
    searchBatches: [],
    searchResults,
    currentPaper: papers[0],
    currentPaperEvidenceLevel: papers[0] ? 'metadata_only' : undefined,
    replyOverride: reply,
    warnings: [],
  }
}

export function createAcademicSearchEvidenceBundle(
  plan: SearchPlan,
  input: AcademicSearchEvidenceBundleInput,
): ToolEvidenceBundle {
  return {
    toolName: 'academic_search',
    plan,
    toolResults: [{ type: 'search_batches', batches: input.batches }],
    evidence: input.evidence ?? [],
    searchBatches: input.batches,
    searchResults: input.searchResults,
    searchResultSet: input.searchResultSet,
    currentPaper: input.evidence?.[0]?.paper,
    currentPaperEvidenceLevel: input.evidence?.[0]?.evidenceLevel,
    warnings: input.warnings ?? [],
  }
}

export function createDeepResearchEvidenceBundle(
  plan: SearchPlan,
  input: DeepResearchEvidenceBundleInput,
): ToolEvidenceBundle {
  return {
    toolName: 'deep_research',
    plan,
    toolResults: input.batches?.length ? [{ type: 'search_batches', batches: input.batches }] : [],
    evidence: input.evidence,
    searchBatches: input.batches ?? [],
    searchResults: input.searchResults,
    searchResultSet: input.searchResultSet,
    currentPaper: input.evidence[0]?.paper,
    currentPaperEvidenceLevel: input.evidence[0]?.evidenceLevel,
    deepResearchReport: input.deepResearchReport,
    warnings: input.warnings ?? [],
  }
}

export function researchJudgmentPaperToSearchResult(paper: PaperJudgmentInput, index: number): SearchResult {
  const url = paper.url ?? ''
  return {
    id: url || `research-judgment-${index + 1}`,
    title: paper.title,
    abstract_text: paper.abstractText ?? null,
    authors: [],
    year: null,
    citation_count: 0,
    open_access_url: url || null,
    open_access_pdf_url: paper.pdfUrl ?? null,
    open_access_landing_url: null,
    source_url: url,
    source: url.includes('arxiv.org') ? 'arxiv' : 'user_url',
    journal: null,
    doi: null,
    published_date: null,
    is_top_journal: false,
    quality_score: 0,
  }
}

export async function previewResearchJudgmentPapers(
  reportInput: ResearchJudgmentReportInput,
  previewer: ResearchJudgmentPreviewer,
  signal?: AbortSignal,
): Promise<PaperPreviewData[]> {
  const previews: PaperPreviewData[] = []
  for (let index = 0; index < reportInput.papers.length; index += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    previews.push(await previewer(researchJudgmentPaperToSearchResult(reportInput.papers[index], index), signal))
  }
  return previews
}

export function createResearchJudgmentEvidenceBundle(
  plan: SearchPlan,
  reportInput: ResearchJudgmentReportInput,
  previews: PaperPreviewData[],
  now: () => string = () => new Date().toISOString(),
): ToolEvidenceBundle {
  const evidence = previews.map(createEvidenceNoteFromPreview)
  const searchResults = previews.map((preview) => preview.paper)
  return {
    toolName: 'deep_research',
    plan,
    toolResults: [{
      type: 'generic',
      title: 'research_judgment_evidence',
      text: `topic: ${reportInput.topic}\npapers: ${reportInput.papers.map((paper) => paper.title).join('; ')}`,
    }],
    evidence,
    searchBatches: [],
    searchResults,
    currentPaper: evidence[0]?.paper,
    currentPaperEvidenceLevel: evidence[0]?.evidenceLevel,
    deepResearchReport: {
      query: reportInput.topic,
      papers: evidence.map((note, index) => ({
        paper: note.paper,
        title: note.paper.title,
        doi: note.paper.doi,
        source: note.paper.source,
        sourceResultIndex: index + 1,
        evidenceLevel: note.evidenceLevel,
        cacheHit: note.cacheHit,
        pdfCacheHit: note.pdfCacheHit,
        warning: note.warning,
      })),
      createdAt: now(),
    },
    warnings: evidence.flatMap((note) => note.warning ? [note.warning] : []),
  }
}

export function createLocalResearchEvidenceBundle(
  plan: SearchPlan,
  paperContext: string,
): ToolEvidenceBundle {
  return {
    toolName: 'read_local_papers',
    plan,
    toolResults: [{ type: 'local_papers', text: paperContext }],
    evidence: [],
    searchBatches: [],
    searchResults: [],
    warnings: paperContext ? [] : ['没有读取到本地论文内容。'],
  }
}

export async function runLocalResearchTool(
  plan: SearchPlan,
  query: string,
  loadLocalPaperContext?: LocalPaperContextLoader,
): Promise<ToolEvidenceBundle> {
  const paperContext = loadLocalPaperContext ? await loadLocalPaperContext(query) : ''
  return createLocalResearchEvidenceBundle(plan, paperContext || '没有读取到本地论文内容。')
}

export async function runPaperDetailTool(
  plan: SearchPlan,
  paper: SearchResult,
  formatPaperDetail: PaperDetailFormatter,
): Promise<ToolEvidenceBundle> {
  return createPaperDetailEvidenceBundle(plan, paper, await formatPaperDetail(paper))
}

export async function runPaperPreviewTool(
  plan: SearchPlan,
  paper: SearchResult,
  previewer: PaperPreviewer,
  signal?: AbortSignal,
): Promise<ToolEvidenceBundle> {
  return createPaperPreviewEvidenceBundle(plan, await previewer(paper, signal))
}

export function createPaperDetailEvidenceBundle(
  plan: SearchPlan,
  paper: SearchResult,
  detailContext: string,
): ToolEvidenceBundle {
  const evidenceLevel = evidenceLevelForPaperDetail(paper)
  return {
    toolName: 'paper_detail',
    plan,
    toolResults: [{ type: 'paper_detail', text: detailContext }],
    evidence: [{
      paper,
      evidenceLevel,
      text: detailContext,
      cacheHit: false,
      pdfCacheHit: false,
    }],
    searchBatches: [],
    searchResults: [paper],
    currentPaper: paper,
    currentPaperEvidenceLevel: evidenceLevel,
    warnings: evidenceLevel === 'metadata_only' ? ['这篇论文没有可用摘要，当前只基于元信息。'] : [],
  }
}

export function createPaperPreviewEvidenceBundle(
  plan: SearchPlan,
  preview: PaperPreviewData,
): ToolEvidenceBundle {
  const previewContext = formatPaperPreviewToolText(preview)
  return {
    toolName: 'paper_preview',
    plan,
    toolResults: [{
      type: 'paper_preview',
      text: previewContext,
      evidenceLevel: preview.evidenceLevel,
    }],
    evidence: [{
      ...createEvidenceNoteFromPreview(preview),
    }],
    searchBatches: [],
    searchResults: [preview.paper],
    currentPaper: preview.paper,
    currentPaperEvidenceLevel: preview.evidenceLevel,
    warnings: preview.message ? [preview.message] : [],
  }
}
