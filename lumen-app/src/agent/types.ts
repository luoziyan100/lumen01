/**
 * [INPUT]: 依赖 services/ai 与 services/search 的公共类型
 * [OUTPUT]: 对外提供 Research Harness 的运行、步骤、计划、工具和传感器类型
 * [POS]: agent 模块的类型边界，供 guides/tools/sensors/runtime 共享
 */
import type { ChatMessage } from '../services/ai'
import type { SearchResult } from '../services/search'

export type ResearchIntent =
  | 'academic_search'
  | 'paper_detail'
  | 'paper_preview'
  | 'deep_research'
  | 'import_to_library'
  | 'local_research'
  | 'answer'
  | 'feedback'
  | 'clarify'

export type RecencyIntent = 'none' | 'latest' | 'this_week' | 'recent_days' | 'this_year' | 'custom_range'
export type SearchSortMode = 'relevance' | 'newest' | 'balanced'
export type SearchMode = 'keyword_search' | 'paper_lookup' | 'recent_ai_feed' | 'arxiv_category_feed'
export type SearchSourceHint = 'all' | 'arxiv' | 'openalex' | 'semantic_scholar' | 'crossref'
export type CategoryPreset = 'ai' | 'llm' | 'vision' | 'robotics' | 'custom'
export type AgentRunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'
export type AgentStepType = 'guide' | 'model' | 'tool' | 'sensor' | 'output'
export type CurrentPaperEvidenceLevel = 'metadata_only' | 'abstract_only' | 'pdf_text_preview'
export type EvidenceRequirement = 'metadata_ok' | 'abstract_ok' | 'single_pdf_required' | 'multi_pdf_required'
export type AgentToolName =
  | 'direct_answer'
  | 'academic_search'
  | 'paper_detail'
  | 'paper_preview'
  | 'deep_research'
  | 'read_local_papers'
  | 'import_to_library'
  | 'clarify'
  | 'feedback'

export interface SearchTimeRange {
  fromDate?: string
  untilDate?: string
}

export interface LocalPaperRequest {
  target?: 'current_library' | 'selected_paper' | 'project' | 'collection'
  query?: string
}

export interface PaperReference {
  resultIndex?: number
  title?: string
  doi?: string
  sourceUrl?: string
  openAccessUrl?: string
}

export interface ResolvedResultSetReferenceContext {
  resultSetId: string
  resultSetLabel: string
  query: string
  indices: number[]
  stableIndices: string[]
  papers: Array<{
    stableIndex: string
    title: string
    doi?: string | null
    sourceUrl?: string
    openAccessUrl?: string
  }>
}

export interface ResolvedUserQuestion {
  originalText: string
  standaloneQuestion: string
  referencedResultSetId?: string
  referencedResultSetLabel?: string
  referencedPaperIndices?: number[]
  referencedPapers?: SearchResult[]
  currentPaper?: SearchResult
  ambiguity?: string
  confidence: number
}

export interface ToolManifestEntry {
  name: AgentToolName
  description: string
  inputSchemaSummary: string
  outputSchemaSummary: string
  network: boolean
  writesPermanentLibrary: boolean
  temporaryOnly: boolean
  allowedWhen: string[]
  forbiddenWhen: string[]
}

export interface AgentContextPack {
  originalUserText: string
  resolvedQuestion: ResolvedUserQuestion
  decision: SearchPlan
  activeObjects: {
    currentPaper?: SearchResult
    activeResultSet?: SearchResultSet
    referencedPapers?: SearchResult[]
    recentResultSets?: SearchResultSet[]
  }
  toolResults: ContextToolResult[]
  evidence: PaperEvidenceNote[]
  constraints: string[]
  warnings: string[]
}

export type ContextToolResult =
  | { type: 'search_batches'; batches: SearchBatch[] }
  | { type: 'paper_detail'; text: string }
  | { type: 'paper_preview'; text: string; evidenceLevel: CurrentPaperEvidenceLevel | string }
  | { type: 'local_papers'; text: string }
  | { type: 'generic'; title: string; text: string }

export interface AgentInputContext {
  currentDate: string
  timezone: string
  hasLocalPapers: boolean
  localPaperCount: number
  activeProjectName?: string
  selectedPaperTitle?: string
  lastSearchResults?: SearchResult[]
  currentPaper?: SearchResult | null
  activeSearchResultSetId?: string
  recentSearchResultSets?: SearchResultSet[]
  nextSearchResultSetLabel?: string
  resolvedResultSetReference?: ResolvedResultSetReferenceContext
  resolvedQuestion?: ResolvedUserQuestion
}

export interface AgentRun {
  id: string
  kind: 'research'
  userText: string
  startedAt: string
  finishedAt?: string
  status: AgentRunStatus
  steps: AgentStep[]
}

export interface AgentStep {
  id: string
  type: AgentStepType
  name: string
  startedAt: string
  finishedAt?: string
  input?: unknown
  output?: unknown
  error?: string
}

export interface SearchPlan {
  intent: ResearchIntent
  shouldSearch: boolean
  queries: string[]
  target?: 'none' | 'resolved_result_set_items'
  evidenceRequirement?: EvidenceRequirement
  targetPaperCount?: number
  searchMode?: SearchMode
  sourceHint?: SearchSourceHint
  categoryPreset?: CategoryPreset
  arxivCategories?: string[]
  feedLimit?: number
  includeTotalCount?: boolean
  response?: string
  reason?: string
  localPaperRequest?: LocalPaperRequest
  paperReference?: PaperReference
  recencyIntent?: RecencyIntent
  timeRange?: SearchTimeRange
  sortMode?: SearchSortMode
}

export interface SearchReflection {
  status: 'sufficient' | 'retry' | 'not_found'
  revisedQueries: string[]
  reason?: string
}

export interface SearchBatch {
  query: string
  total: number
  results: SearchResult[]
  mode?: SearchMode
  totalAvailable?: number
  fetched?: number
  categories?: string[]
  fromDate?: string
  untilDate?: string
}

export interface SearchResultSet {
  id: string
  label: string
  noteId?: string
  query: string
  plan: SearchPlan
  mode?: SearchMode
  totalAvailable?: number
  fetched?: number
  categories?: string[]
  fromDate?: string
  untilDate?: string
  results: SearchResult[]
  createdAt: string
}

export interface SensorResult {
  ok: boolean
  name: string
  severity: 'info' | 'warning' | 'error'
  message: string
}

export interface PaperEvidenceNote {
  paper: SearchResult
  evidenceLevel: CurrentPaperEvidenceLevel
  text: string
  cacheHit: boolean
  pdfCacheHit: boolean
  warning?: string
}

export interface DeepResearchReportArtifact {
  query: string
  papers: Array<{
    paper: SearchResult
    title: string
    doi: string | null
    source: string
    sourceResultSetId?: string
    sourceResultIndex?: number
    evidenceLevel: CurrentPaperEvidenceLevel
    cacheHit: boolean
    pdfCacheHit: boolean
    warning?: string
  }>
  createdAt: string
}

export interface ToolResult<T> {
  ok: boolean
  data?: T
  error?: string
}

export interface RunResearchHarnessInput {
  userText: string
  history: ChatMessage[]
  recentMessages: ChatMessage[]
  context: AgentInputContext
  loadLocalPaperContext?: (userText: string) => Promise<string>
  signal?: AbortSignal
}

export interface ResearchAgentResult {
  reply: string
  searched: boolean
  plan: SearchPlan
  searchResults?: SearchResult[]
  searchResultSet?: SearchResultSet
  searchResultSetLabel?: string
  sourceResultSetId?: string
  currentPaper?: SearchResult
  currentPaperEvidenceLevel?: CurrentPaperEvidenceLevel
  paperEvidenceNotes?: PaperEvidenceNote[]
  deepResearchReport?: DeepResearchReportArtifact
  reflection?: SearchReflection
  risks?: SensorResult[]
  trace: AgentRun
}
