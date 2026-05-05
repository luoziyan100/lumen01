import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPlannerContextPack, buildSynthesisContextPack } from '../src/agent/context-pack.ts'
import { loadResearchContext } from '../src/agent/context-loader.ts'
import { applyRetrievedResearchObjects, retrieveActiveResearchObjects } from '../src/agent/context-retrieval.ts'
import { getResearchPipelineStageNames } from '../src/agent/pipeline-stages.ts'
import { buildPlannerUserPrompt } from '../src/agent/prompts.ts'
import { resolvePaperReference } from '../src/agent/tools.ts'
import {
  createNoToolEvidenceBundle,
  createAcademicSearchEvidenceBundle,
  createDeepResearchEvidenceBundle,
  createLocalResearchEvidenceBundle,
  createPaperDetailEvidenceBundle,
  createPaperPreviewEvidenceBundle,
  createReplyOverrideEvidenceBundle,
  createResearchJudgmentEvidenceBundle,
  createSearchResultSetFromBatches,
  buildDeepResearchReportArtifact,
  previewPapersAsEvidence,
  previewResearchJudgmentPapers,
  researchJudgmentPaperToSearchResult,
  runAcademicSearchTool,
  runLocalResearchTool,
  runPaperDetailTool,
  runPaperPreviewTool,
  createResultSetLinksEvidenceBundle,
} from '../src/agent/tool-runtime.ts'
import { buildSynthesisInput, synthesizeResearchJudgmentReport } from '../src/agent/synthesis.ts'
import { buildResearchWritebackPlan } from '../src/agent/writeback.ts'
import type { ChatMessage } from '../src/services/ai.ts'
import type { PaperPreviewData } from '../src/services/paper-preview.ts'
import type { SearchResult } from '../src/services/search.ts'
import type { ResearchJudgmentReportInput } from '../src/agent/research-judgment.ts'
import type {
  ResearchWritebackPlan,
  RunResearchHarnessInput,
  SearchBatch,
  SearchPlan,
  SearchResultSet,
  DeepResearchReportArtifact,
  PaperEvidenceNote,
  ToolResult,
  ToolEvidenceBundle,
} from '../src/agent/types.ts'

function baseInput(overrides: Partial<RunResearchHarnessInput> = {}): RunResearchHarnessInput {
  return {
    userText: '看 R1-1',
    history: [],
    recentMessages: [],
    context: {
      currentDate: '2026-05-04',
      timezone: 'America/Los_Angeles',
      hasLocalPapers: false,
      localPaperCount: 0,
    },
    ...overrides,
  }
}

function resultSet(id: string, label: string, query: string): SearchResultSet {
  return {
    id,
    label,
    query,
    plan: { intent: 'academic_search', shouldSearch: true, queries: [query] },
    results: [],
    createdAt: '2026-05-04T00:00:00.000Z',
  }
}

function paper(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'paper-1',
    title: 'Paper One',
    abstract_text: 'abstract',
    authors: [],
    year: 2026,
    citation_count: 0,
    open_access_url: null,
    open_access_pdf_url: null,
    open_access_landing_url: null,
    source_url: 'https://example.org/paper-1',
    source: 'test',
    journal: null,
    doi: null,
    published_date: '2026-05-04',
    is_top_journal: false,
    quality_score: 0,
    ...overrides,
  }
}

test('tool evidence bundle is the standard handoff into synthesis', () => {
  const bundle: ToolEvidenceBundle = {
    toolName: 'direct_answer',
    plan: { intent: 'answer', shouldSearch: false, queries: [] },
    toolResults: [],
    evidence: [],
    searchBatches: [],
    searchResults: [],
    warnings: [],
  }

  assert.equal(bundle.toolName, 'direct_answer')
  assert.equal(bundle.plan.intent, 'answer')
})

test('writeback plan keeps assistant note separate from structured artifacts', () => {
  const plan: ResearchWritebackPlan = {
    assistantReply: 'final answer',
    artifacts: [],
    state: {},
  }

  assert.equal(plan.assistantReply, 'final answer')
  assert.deepEqual(plan.artifacts, [])
})

test('context loader exposes active objects without compressing them into prose', () => {
  const loaded = loadResearchContext(baseInput({
    userText: '看 R1-1',
    context: {
      currentDate: '2026-05-04',
      timezone: 'America/Los_Angeles',
      hasLocalPapers: false,
      localPaperCount: 0,
      activeSearchResultSetId: 'rs-1',
      recentSearchResultSets: [resultSet('rs-1', 'R1', 'agent memory')],
    },
  }))

  assert.equal(loaded.userText, '看 R1-1')
  assert.equal(loaded.activeResultSet?.label, 'R1')
})

test('context retrieval returns the active result set first', () => {
  const loaded = loadResearchContext(baseInput({
    userText: '继续看这个结果集',
    context: {
      currentDate: '2026-05-04',
      timezone: 'America/Los_Angeles',
      hasLocalPapers: false,
      localPaperCount: 0,
      activeSearchResultSetId: 'rs-2',
      recentSearchResultSets: [
        resultSet('rs-1', 'R1', 'old'),
        resultSet('rs-2', 'R2', 'active'),
      ],
    },
  }))

  const retrieved = retrieveActiveResearchObjects(loaded)
  assert.equal(retrieved.activeResultSet?.label, 'R2')
})

test('context retrieval materializes active objects into downstream context', () => {
  const activePaper = paper({ id: 'paper-active', title: 'Active Result Set Paper' })
  const stalePaper = paper({ id: 'paper-stale', title: 'Stale Last Result Paper' })
  const input = baseInput({
    userText: '看 R2-1',
    context: {
      currentDate: '2026-05-04',
      timezone: 'America/Los_Angeles',
      hasLocalPapers: false,
      localPaperCount: 0,
      activeSearchResultSetId: 'rs-2',
      lastSearchResults: [stalePaper],
      recentSearchResultSets: [
        { ...resultSet('rs-1', 'R1', 'old'), results: [stalePaper] },
        { ...resultSet('rs-2', 'R2', 'active'), results: [activePaper] },
      ],
    },
  })
  const loaded = loadResearchContext(input)
  const retrieved = retrieveActiveResearchObjects(loaded)
  const downstream = applyRetrievedResearchObjects(input, retrieved)

  assert.equal(downstream.context.activeSearchResultSetId, 'rs-2')
  assert.equal(downstream.context.lastSearchResults?.[0]?.title, 'Active Result Set Paper')
})

test('planner and synthesis packs are explicit pipeline stages', () => {
  const input = loadResearchContext(baseInput({ userText: '找 agent memory 论文' }))
  const resolvedQuestion = {
    originalText: input.userText,
    standaloneQuestion: input.userText,
    confidence: 1,
  }
  const decision: SearchPlan = { intent: 'academic_search', shouldSearch: true, queries: ['agent memory'] }

  const plannerPack = buildPlannerContextPack(input, resolvedQuestion, decision)
  const synthesisPack = buildSynthesisContextPack(input, resolvedQuestion, decision, { evidence: [] })

  assert.equal(plannerPack.decision.intent, 'academic_search')
  assert.equal(synthesisPack.evidence.length, 0)
})

test('planner prompt hides stale paper objects for bare pronoun questions', () => {
  const stalePaper = paper({ title: 'Stale Mechanistic Paper' })
  const resultSetPaper = paper({ id: 'paper-2', title: 'Old Search Result Paper' })
  const prompt = buildPlannerUserPrompt({
    currentDate: '2026-05-04',
    timezone: 'America/Los_Angeles',
    hasLocalPapers: false,
    localPaperCount: 0,
    currentPaper: stalePaper,
    lastSearchResults: [resultSetPaper],
    activeSearchResultSetId: 'rs-1',
    recentSearchResultSets: [{
      ...resultSet('rs-1', 'R1', 'agent memory'),
      results: [resultSetPaper],
    }],
    resolvedQuestion: {
      originalText: '它怎么用',
      standaloneQuestion: '它怎么用',
      confidence: 0.45,
    },
  }, '', '它怎么用')

  assert.equal(prompt.includes('Stale Mechanistic Paper'), false)
  assert.equal(prompt.includes('Old Search Result Paper'), false)
  assert.match(prompt, /"currentPaper": null/)
})

test('planner prompt exposes result-set objects for strong result-set references', () => {
  const resultSetPaper = paper({ id: 'paper-2', title: 'Referenced Search Result Paper' })
  const prompt = buildPlannerUserPrompt({
    currentDate: '2026-05-04',
    timezone: 'America/Los_Angeles',
    hasLocalPapers: false,
    localPaperCount: 0,
    activeSearchResultSetId: 'rs-1',
    recentSearchResultSets: [{
      ...resultSet('rs-1', 'R1', 'agent memory'),
      results: [resultSetPaper],
    }],
  }, '', '分析 R1 前 1 篇')

  assert.equal(prompt.includes('Referenced Search Result Paper'), true)
  assert.match(prompt, /"recentSearchResultSets": \[/)
})

test('paper resolver rejects bare pronouns instead of falling back to stale current paper', () => {
  const stalePaper = paper({ title: 'Stale Mechanistic Paper' })
  const result = resolvePaperReference(
    { intent: 'paper_preview', shouldSearch: false, queries: [] },
    '它这个架构怎么用',
    {
      currentPaper: stalePaper,
      lastSearchResults: [paper({ id: 'paper-2', title: 'Old Search Result Paper' })],
    },
  )

  assert.equal(result.ok, false)
})

test('writeback builder turns agent result into structured artifacts', () => {
  const writeback = buildResearchWritebackPlan({
    reply: 'answer',
    searched: false,
    plan: { intent: 'deep_research', shouldSearch: false, queries: [] },
    trace: {
      id: 'trace-1',
      kind: 'research',
      userText: 'deep read',
      startedAt: '2026-05-04T00:00:00.000Z',
      status: 'succeeded',
      steps: [],
    },
    deepResearchReport: {
      query: 'deep read',
      papers: [],
      createdAt: '2026-05-04T00:00:00.000Z',
    },
  }, {
    assistantNoteId: 'note-1',
    query: 'deep read',
    nextSearchResultSetLabel: 'R3',
    now: () => '2026-05-04T00:00:00.000Z',
    createResultSetId: () => 'rs-test',
  })

  assert.equal(writeback.assistantReply, 'answer')
  assert.equal(writeback.artifacts[0].type, 'deep_research_report')
  assert.equal(writeback.artifacts[0].noteId, 'note-1')
})

test('writeback builder creates search result set artifact payloads', () => {
  const writeback = buildResearchWritebackPlan({
    reply: 'search answer',
    searched: true,
    searchResults: [{
      id: 'paper-1',
      title: 'Paper One',
      abstract_text: 'abstract',
      authors: [],
      year: 2026,
      citation_count: 0,
      open_access_url: null,
      open_access_pdf_url: null,
      open_access_landing_url: null,
      source_url: 'https://example.org/paper-1',
      source: 'test',
      journal: null,
      doi: null,
      published_date: '2026-05-04',
      is_top_journal: false,
      quality_score: 0,
    }],
    plan: { intent: 'academic_search', shouldSearch: true, queries: ['paper one'], searchMode: 'keyword_search' },
    trace: {
      id: 'trace-1',
      kind: 'research',
      userText: 'paper one',
      startedAt: '2026-05-04T00:00:00.000Z',
      status: 'succeeded',
      steps: [],
    },
  }, {
    assistantNoteId: 'note-2',
    query: 'paper one',
    nextSearchResultSetLabel: 'R7',
    now: () => '2026-05-04T00:00:00.000Z',
    createResultSetId: () => 'rs-generated',
  })

  assert.equal(writeback.state.searchResultSet?.label, 'R7')
  assert.equal(writeback.state.lastSearchResults?.[0].title, 'Paper One')
  assert.equal(writeback.artifacts[0].type, 'search_results')
  assert.equal((writeback.artifacts[0].data as { resultSet: SearchResultSet }).resultSet.id, 'rs-generated')
})

test('writeback builder preserves preview evidence source and temporary PDF path', () => {
  const selectedPaper = paper({ title: 'Cached PDF Paper' })
  const writeback = buildResearchWritebackPlan({
    reply: 'preview answer',
    searched: false,
    plan: { intent: 'paper_preview', shouldSearch: false, queries: [] },
    trace: {
      id: 'trace-1',
      kind: 'research',
      userText: 'preview',
      startedAt: '2026-05-04T00:00:00.000Z',
      status: 'succeeded',
      steps: [],
    },
    paperEvidenceNotes: [{
      paper: selectedPaper,
      evidenceLevel: 'pdf_text_preview',
      text: 'preview',
      cacheHit: false,
      pdfCacheHit: true,
      evidenceSource: 'pdf_text',
      pdfUrl: 'https://example.org/paper.pdf',
      pdfTempPath: '/tmp/lumen/paper.pdf',
    }],
  }, {
    assistantNoteId: 'note-3',
    now: () => '2026-05-04T00:00:00.000Z',
  })

  const previewArtifact = writeback.artifacts.find((artifact) => artifact.type === 'paper_preview')
  const firstPaper = (previewArtifact?.data as { papers: Array<{ pdfTempPath?: string; evidenceSource?: string; pdfUrl?: string }> }).papers[0]

  assert.equal(firstPaper.evidenceSource, 'pdf_text')
  assert.equal(firstPaper.pdfUrl, 'https://example.org/paper.pdf')
  assert.equal(firstPaper.pdfTempPath, '/tmp/lumen/paper.pdf')
})

test('runtime exposes target pipeline stage names', () => {
  assert.deepEqual(getResearchPipelineStageNames(), [
    'context_loader',
    'context_retrieval',
    'question_resolution',
    'planner_context_pack',
    'planner_decision',
    'runtime_guard',
    'tool_runtime',
    'tool_evidence',
    'synthesis_context_pack',
    'synthesis',
    'state_writeback',
    'compression_hook',
  ])
})

test('recent messages remain structured chat messages in loaded context', () => {
  const recentMessages: ChatMessage[] = [{ role: 'user', content: '上一轮问题' }]
  const loaded = loadResearchContext(baseInput({ recentMessages }))

  assert.equal(loaded.recentMessages[0].content, '上一轮问题')
})

test('tool runtime can represent direct-answer decisions as evidence bundles', () => {
  const bundle = createNoToolEvidenceBundle({
    intent: 'answer',
    shouldSearch: false,
    queries: [],
    response: '可以直接回答',
  })

  assert.equal(bundle.toolName, 'direct_answer')
  assert.equal(bundle.replyOverride, '可以直接回答')
  assert.deepEqual(bundle.toolResults, [])
  assert.deepEqual(bundle.evidence, [])
})

test('tool runtime can represent non-research replies as reply overrides', () => {
  const plan: SearchPlan = {
    intent: 'clarify',
    shouldSearch: false,
    queries: [],
    response: '请明确要看哪一篇。',
  }
  const bundle = createReplyOverrideEvidenceBundle('clarify', plan, '请明确要看哪一篇。')

  assert.equal(bundle.toolName, 'clarify')
  assert.equal(bundle.replyOverride, '请明确要看哪一篇。')
  assert.deepEqual(bundle.toolResults, [{ type: 'generic', title: 'clarify', text: '请明确要看哪一篇。' }])
  assert.deepEqual(bundle.evidence, [])
})

test('tool runtime can represent result-set link replies as paper detail bundles', () => {
  const selectedPaper = paper({
    title: 'Linked Paper',
    source_url: 'https://example.org/source',
    open_access_pdf_url: 'https://example.org/paper.pdf',
    doi: '10.1234/example',
  })
  const plan: SearchPlan = {
    intent: 'paper_detail',
    shouldSearch: false,
    queries: [],
    target: 'resolved_result_set_items',
  }
  const bundle = createResultSetLinksEvidenceBundle(plan, 'R2', [selectedPaper], [3], [selectedPaper])

  assert.equal(bundle.toolName, 'paper_detail')
  assert.equal(bundle.replyOverride?.includes('R2-3. Linked Paper'), true)
  assert.equal(bundle.replyOverride?.includes('PDF: https://example.org/paper.pdf'), true)
  assert.equal(bundle.currentPaper?.title, 'Linked Paper')
  assert.equal(bundle.currentPaperEvidenceLevel, 'metadata_only')
  assert.deepEqual(bundle.searchResults, [selectedPaper])
  assert.equal(bundle.toolResults[0].type, 'paper_detail')
})

test('tool runtime can represent academic search evidence bundles', () => {
  const selectedPaper = paper({ title: 'Search Result Paper' })
  const plan: SearchPlan = { intent: 'academic_search', shouldSearch: true, queries: ['search result'] }
  const batch: SearchBatch = { query: 'search result', total: 1, results: [selectedPaper], mode: 'keyword_search' }
  const set: SearchResultSet = {
    id: 'rs-search',
    label: 'R9',
    query: 'search result',
    plan,
    results: [selectedPaper],
    createdAt: '2026-05-04T00:00:00.000Z',
  }
  const bundle = createAcademicSearchEvidenceBundle(plan, {
    batches: [batch],
    searchResults: [selectedPaper],
    searchResultSet: set,
  })

  assert.equal(bundle.toolName, 'academic_search')
  assert.deepEqual(bundle.toolResults, [{ type: 'search_batches', batches: [batch] }])
  assert.equal(bundle.searchResultSet?.label, 'R9')
  assert.deepEqual(bundle.searchResults, [selectedPaper])
})

test('tool runtime creates stable search result sets from batches', () => {
  const selectedPaper = paper({ title: 'Generated Result Set Paper' })
  const plan: SearchPlan = {
    intent: 'academic_search',
    shouldSearch: true,
    queries: ['generated'],
    searchMode: 'keyword_search',
  }
  const batch: SearchBatch = {
    query: 'generated',
    total: 10,
    fetched: 1,
    results: [selectedPaper],
    mode: 'keyword_search',
    categories: ['cs.AI'],
  }
  const set = createSearchResultSetFromBatches({
    userText: 'generated query',
    nextSearchResultSetLabel: 'R5',
    plan,
    batches: [batch],
    results: [selectedPaper],
    now: () => '2026-05-04T00:00:00.000Z',
    createId: () => 'rs-fixed',
  })

  assert.equal(set.id, 'rs-fixed')
  assert.equal(set.label, 'R5')
  assert.equal(set.fetched, 1)
  assert.deepEqual(set.categories, ['cs.AI'])
})

test('tool runtime orchestrates academic search reflection retry', async () => {
  const firstPaper = paper({ id: 'paper-first', title: 'First Try' })
  const retryPaper = paper({ id: 'paper-retry', title: 'Retry Hit', quality_score: 10 })
  const plan: SearchPlan = { intent: 'academic_search', shouldSearch: true, queries: ['bad query'] }
  const calls: string[] = []

  const result = await runAcademicSearchTool({
    userText: 'find agent memory papers',
    plan,
    search: async (searchPlan, phase): Promise<ToolResult<SearchBatch[]>> => {
      calls.push(`${phase}:${searchPlan.queries.join(',')}`)
      return {
        ok: true,
        data: [{
          query: searchPlan.queries[0],
          total: 1,
          results: phase === 'retry' ? [retryPaper] : [firstPaper],
        }],
      }
    },
    reflect: async () => ({
      status: 'retry',
      revisedQueries: ['better query'],
      reason: 'too broad',
    }),
    merge: (batches) => batches.flatMap((batch) => batch.results),
  })

  assert.deepEqual(calls, ['initial:bad query', 'retry:better query'])
  assert.equal(result.reflection.status, 'sufficient')
  assert.equal(result.searchResults[1].title, 'Retry Hit')
})

test('tool runtime can represent deep research evidence bundles', () => {
  const selectedPaper = paper({ title: 'Deep Evidence Paper' })
  const plan: SearchPlan = { intent: 'deep_research', shouldSearch: false, queries: [] }
  const note: PaperEvidenceNote = {
    paper: selectedPaper,
    evidenceLevel: 'pdf_text_preview',
    text: 'full-ish preview text',
    cacheHit: false,
    pdfCacheHit: true,
  }
  const report: DeepResearchReportArtifact = {
    query: 'deep read',
    papers: [{
      paper: selectedPaper,
      title: selectedPaper.title,
      doi: selectedPaper.doi,
      source: selectedPaper.source,
      evidenceLevel: 'pdf_text_preview',
      cacheHit: false,
      pdfCacheHit: true,
    }],
    createdAt: '2026-05-04T00:00:00.000Z',
  }
  const bundle = createDeepResearchEvidenceBundle(plan, {
    searchResults: [selectedPaper],
    evidence: [note],
    deepResearchReport: report,
  })

  assert.equal(bundle.toolName, 'deep_research')
  assert.equal(bundle.currentPaper?.title, 'Deep Evidence Paper')
  assert.equal(bundle.currentPaperEvidenceLevel, 'pdf_text_preview')
  assert.deepEqual(bundle.evidence, [note])
  assert.equal(bundle.deepResearchReport?.papers[0].title, 'Deep Evidence Paper')
})

test('tool runtime builds deep research report artifacts from evidence notes', () => {
  const selectedPaper = paper({ title: 'Report Artifact Paper' })
  const note: PaperEvidenceNote = {
    paper: selectedPaper,
    evidenceLevel: 'abstract_only',
    text: 'abstract',
    cacheHit: true,
    pdfCacheHit: false,
  }
  const report = buildDeepResearchReportArtifact('deep topic', [note], {
    resultSetId: 'rs-1',
    indices: [2],
    now: () => '2026-05-04T00:00:00.000Z',
  })

  assert.equal(report.query, 'deep topic')
  assert.equal(report.papers[0].sourceResultSetId, 'rs-1')
  assert.equal(report.papers[0].sourceResultIndex, 2)
})

test('tool runtime previews papers as evidence notes through an injected previewer', async () => {
  const selectedPaper = paper({ title: 'Preview Evidence Paper' })
  const notes = await previewPapersAsEvidence([selectedPaper], async (searchPaper) => ({
    paper: searchPaper,
    evidenceLevel: 'abstract_only',
    text: 'previewed abstract',
    cacheHit: true,
    pdfCacheHit: false,
  }))

  assert.equal(notes[0].paper.title, 'Preview Evidence Paper')
  assert.equal(notes[0].text, 'previewed abstract')
  assert.equal(notes[0].evidenceSource, 'abstract')
})

test('tool runtime can represent local research evidence bundles', () => {
  const plan: SearchPlan = {
    intent: 'local_research',
    shouldSearch: false,
    queries: [],
    localPaperRequest: { query: 'agent memory' },
  }
  const bundle = createLocalResearchEvidenceBundle(plan, 'local paper context')

  assert.equal(bundle.toolName, 'read_local_papers')
  assert.deepEqual(bundle.toolResults, [{ type: 'local_papers', text: 'local paper context' }])
  assert.deepEqual(bundle.evidence, [])
  assert.deepEqual(bundle.searchResults, [])
})

test('tool runtime runs local research through a loader and returns a bundle', async () => {
  const plan: SearchPlan = { intent: 'local_research', shouldSearch: false, queries: [] }
  const bundle = await runLocalResearchTool(plan, 'agent memory', async (query) => `local:${query}`)

  assert.equal(bundle.toolName, 'read_local_papers')
  assert.equal(bundle.toolResults[0].type, 'local_papers')
  assert.match(bundle.toolResults[0].text, /local:agent memory/)
})

test('tool runtime runs paper detail through a formatter and returns a bundle', async () => {
  const selectedPaper = paper({ title: 'Detail Tool Paper' })
  const plan: SearchPlan = { intent: 'paper_detail', shouldSearch: false, queries: [] }
  const bundle = await runPaperDetailTool(plan, selectedPaper, async (searchPaper) => `detail:${searchPaper.title}`)

  assert.equal(bundle.toolName, 'paper_detail')
  assert.equal(bundle.toolResults[0].type, 'paper_detail')
  assert.match(bundle.toolResults[0].text, /Detail Tool Paper/)
})

test('tool runtime runs paper preview through a previewer and returns a bundle', async () => {
  const selectedPaper = paper({ title: 'Preview Tool Paper' })
  const plan: SearchPlan = { intent: 'paper_preview', shouldSearch: false, queries: [] }
  const bundle = await runPaperPreviewTool(plan, selectedPaper, async (searchPaper) => ({
    paper: searchPaper,
    evidenceLevel: 'abstract_only',
    text: 'preview text',
    cacheHit: true,
    pdfCacheHit: false,
  }))

  assert.equal(bundle.toolName, 'paper_preview')
  assert.equal(bundle.currentPaper?.title, 'Preview Tool Paper')
  assert.equal(bundle.evidence[0].evidenceSource, 'abstract')
})

test('tool runtime can represent research judgment as deep research evidence', () => {
  const reportInput: ResearchJudgmentReportInput = {
    topic: 'Lumen 借鉴价值判断',
    papers: [{
      title: 'Self-Evolving Agent Memory',
      url: 'https://arxiv.org/abs/2603.00001',
      abstractText: 'Memory retrieval and experience graph for agents.',
    }],
  }
  const searchPaper = researchJudgmentPaperToSearchResult(reportInput.papers[0], 0)
  const preview: PaperPreviewData = {
    paper: searchPaper,
    evidenceLevel: 'pdf_text_preview',
    text: 'This paper builds an agent memory graph with retrieval, feedback, and experience reuse.',
    cacheHit: false,
    pdfCacheHit: true,
    pdfResolution: {
      pdfUrl: 'https://arxiv.org/pdf/2603.00001',
      pdfCachePath: '/tmp/lumen-research/2603.00001.pdf',
      attempts: [],
    },
  }
  const plan: SearchPlan = {
    intent: 'deep_research',
    shouldSearch: false,
    queries: [],
    evidenceRequirement: 'multi_pdf_required',
    reason: 'research_judgment_analysis_mode',
  }

  const bundle = createResearchJudgmentEvidenceBundle(plan, reportInput, [preview])
  const report = synthesizeResearchJudgmentReport(reportInput, bundle)

  assert.equal(bundle.toolName, 'deep_research')
  assert.equal(bundle.evidence[0].evidenceLevel, 'pdf_text_preview')
  assert.equal(bundle.evidence[0].pdfTempPath, '/tmp/lumen-research/2603.00001.pdf')
  assert.equal(bundle.deepResearchReport?.query, 'Lumen 借鉴价值判断')
  assert.equal(bundle.currentPaper?.title, 'Self-Evolving Agent Memory')
  assert.match(report, /长期记忆|经验|memory/i)
})

test('tool runtime previews research judgment papers through an injected previewer', async () => {
  const reportInput: ResearchJudgmentReportInput = {
    topic: '判断',
    papers: [{ title: 'Paper A', url: 'https://arxiv.org/abs/2603.00001' }],
  }
  const previews = await previewResearchJudgmentPapers(reportInput, async (searchPaper) => ({
    paper: searchPaper,
    evidenceLevel: 'abstract_only',
    text: searchPaper.abstract_text ?? 'abstract fallback',
    cacheHit: false,
    pdfCacheHit: false,
  }))

  assert.equal(previews[0].paper.title, 'Paper A')
  assert.equal(previews[0].paper.source, 'arxiv')
  assert.equal(previews[0].evidenceLevel, 'abstract_only')
})

test('tool runtime can represent paper detail evidence bundles', () => {
  const plan: SearchPlan = { intent: 'paper_detail', shouldSearch: false, queries: [] }
  const selectedPaper = paper({ title: 'Mechanistic Evaluation of Reports', abstract_text: 'Full abstract.' })
  const bundle = createPaperDetailEvidenceBundle(plan, selectedPaper, 'paper detail context')

  assert.equal(bundle.toolName, 'paper_detail')
  assert.equal(bundle.currentPaper?.title, 'Mechanistic Evaluation of Reports')
  assert.equal(bundle.currentPaperEvidenceLevel, 'abstract_only')
  assert.deepEqual(bundle.toolResults, [{ type: 'paper_detail', text: 'paper detail context' }])
  assert.deepEqual(bundle.searchResults, [selectedPaper])
})

test('tool runtime can represent paper preview evidence bundles', () => {
  const plan: SearchPlan = { intent: 'paper_preview', shouldSearch: false, queries: [] }
  const selectedPaper = paper({ title: 'Previewed Evidence Paper' })
  const preview: PaperPreviewData = {
    paper: selectedPaper,
    evidenceLevel: 'pdf_text_preview',
    text: 'preview text from local temporary PDF',
    cacheHit: false,
    pdfCacheHit: false,
  }
  const bundle = createPaperPreviewEvidenceBundle(plan, preview)

  assert.equal(bundle.toolName, 'paper_preview')
  assert.equal(bundle.currentPaper?.title, 'Previewed Evidence Paper')
  assert.equal(bundle.currentPaperEvidenceLevel, 'pdf_text_preview')
  assert.equal(bundle.toolResults[0].type, 'paper_preview')
  assert.equal(bundle.toolResults[0].evidenceLevel, 'pdf_text_preview')
  assert.match(bundle.toolResults[0].text, /证据来源：pdf_text_preview/)
  assert.match(bundle.toolResults[0].text, /边界：paper_preview 只做临时读取，不会加入文献库。/)
  assert.match(bundle.toolResults[0].text, /preview text from local temporary PDF/)
  assert.equal(bundle.evidence[0].paper.title, 'Previewed Evidence Paper')
  assert.equal(bundle.evidence[0].evidenceLevel, 'pdf_text_preview')
})

test('synthesis input is built from resolved question, decision, and tool evidence', () => {
  const input = baseInput({ userText: '解释这篇论文' })
  const resolvedQuestion = {
    originalText: input.userText,
    standaloneQuestion: '解释 R1-1 这篇论文',
    confidence: 0.9,
  }
  const decision: SearchPlan = { intent: 'paper_preview', shouldSearch: false, queries: [] }
  const bundle = createNoToolEvidenceBundle(decision)
  const synthesisInput = buildSynthesisInput(input, resolvedQuestion, decision, bundle)

  assert.equal(synthesisInput.resolvedQuestion.standaloneQuestion, '解释 R1-1 这篇论文')
  assert.equal(synthesisInput.decision.intent, 'paper_preview')
  assert.equal(synthesisInput.toolEvidence.toolName, 'direct_answer')
})
