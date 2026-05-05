/**
 * [INPUT]: 依赖 agent/guides、agent/tools、agent/sensors、agent/prompts、services/ai
 * [OUTPUT]: 对外提供 runResearchHarness
 * [POS]: agent 模块的统一运行时，编排规划、工具、传感器、综合回答与本地 trace
 */
import { chatWithAgentModel, type ChatMessage } from '../services/ai'
import { formatPaperDetailContext, previewSearchResultPaper, type PaperPreviewData } from '../services/paper-preview'
import type { SearchResult } from '../services/search'
import { deterministicExternalSearchPlan, looksLikeExternalSearchRequest, planResearchAction } from './guides'
import { buildEvidenceSynthesisUserPrompt, buildPaperDetailUserPrompt, buildPaperPreviewUserPrompt, buildSynthesisUserPrompt } from './prompts'
import { buildPlannerContextPack, buildSynthesisContextPack, formatContextPackForModel } from './context-pack'
import { loadResearchContext } from './context-loader'
import { applyRetrievedResearchObjects, retrieveActiveResearchObjects } from './context-retrieval'
import { maybeCompressChatHistory } from './compression'
import { resolveUserQuestion } from './reference-resolver'
import {
  createAcademicSearchEvidenceBundle,
  createDeepResearchEvidenceBundle,
  createNoToolEvidenceBundle,
  createReplyOverrideEvidenceBundle,
  createResearchJudgmentEvidenceBundle,
  createSearchResultSetFromBatches,
  buildDeepResearchReportArtifact,
  previewPapersAsEvidence,
  previewResearchJudgmentPapers,
  runAcademicSearchTool,
  runLocalResearchTool,
  runPaperDetailTool,
  runPaperPreviewTool,
  createResultSetLinksEvidenceBundle,
} from './tool-runtime'
import {
  detectResearchJudgmentRequest,
  extractResearchJudgmentInput,
} from './research-judgment'
import { synthesizeResearchJudgmentReport } from './synthesis'
import { detectAnswerRisks, reflectOnSearchResults } from './sensors'
import {
  mergeSearchBatches,
  requestedEvidencePaperCount,
  requiresPrimarySource,
  resolvePaperReference,
  resolvePaperReferences,
  resolveResultSetReference,
  runAcademicSearches,
  selectEvidencePapers,
  shouldForceNewSearch,
  isResultSetLinkRequest,
  type PaperReferenceContext,
} from './tools'
import {
  createAgentRun,
  failAgentRun,
  finishAgentRun,
  recordAgentStep,
} from './traces'
import type {
  ResearchAgentResult,
  RunResearchHarnessInput,
  PaperEvidenceNote,
  SearchBatch,
  SearchPlan,
  SearchReflection,
  SearchResultSet,
  ResolvedResultSetReferenceContext,
  ResolvedUserQuestion,
  ContextToolResult,
  ToolEvidenceBundle,
  ToolResult,
} from './types'
export { getResearchPipelineStageNames } from './pipeline-stages'

function isMissingAiConfigError(error: unknown): boolean {
  return String(error).includes('请先在设置中配置 AI API Key')
}

function fallbackResolvedQuestion(input: RunResearchHarnessInput): ResolvedUserQuestion {
  return {
    originalText: input.userText,
    standaloneQuestion: input.userText,
    currentPaper: input.context.currentPaper ?? undefined,
    confidence: 0.5,
  }
}

function formatSynthesisContextPack(
  input: RunResearchHarnessInput,
  plan: SearchPlan,
  options: {
    toolResults?: ContextToolResult[]
    evidence?: PaperEvidenceNote[]
    warnings?: string[]
  } = {},
): string {
  return formatContextPackForModel(buildSynthesisContextPack(
    input,
    input.context.resolvedQuestion ?? fallbackResolvedQuestion(input),
    plan,
    options,
  ))
}

function resolvePaperFromCurrentTurn(
  plan: SearchPlan,
  userText: string,
  context: PaperReferenceContext,
  resolvedQuestion?: ResolvedUserQuestion,
): ToolResult<SearchResult> {
  const referencedPapers = resolvedQuestion?.referencedPapers ?? []
  if (referencedPapers.length === 1) return { ok: true, data: referencedPapers[0] }
  if (referencedPapers.length > 1) {
    return {
      ok: false,
      error: '本轮引用了多篇论文。请指定其中一篇，例如 R1-1，或改用多篇 deep_research。',
    }
  }
  return resolvePaperReference(plan, userText, context)
}

function resolvePapersFromCurrentTurn(
  plan: SearchPlan,
  userText: string,
  context: PaperReferenceContext,
  resolvedQuestion: ResolvedUserQuestion | undefined,
  limit: number,
): ToolResult<SearchResult[]> {
  const referencedPapers = resolvedQuestion?.referencedPapers ?? []
  if (referencedPapers.length > 0) return { ok: true, data: referencedPapers.slice(0, limit) }
  return resolvePaperReferences(plan, userText, context, limit)
}

async function synthesizeAnswer(
  input: RunResearchHarnessInput,
  plan: SearchPlan,
  toolEvidence: ToolEvidenceBundle,
  reflection?: SearchReflection,
): Promise<string> {
  const synthesisMessages: ChatMessage[] = [
    ...input.history,
    {
      role: 'user',
      content: `${formatSynthesisContextPack(input, plan, {
        toolResults: toolEvidence.toolResults,
        warnings: toolEvidence.warnings,
      })}\n\n---\n\n${buildSynthesisUserPrompt(input.userText, plan, toolEvidence.searchBatches, reflection)}`,
    },
  ]

  return chatWithAgentModel(synthesisMessages, 'synthesizer', input.signal)
}

async function synthesizePaperDetail(
  input: RunResearchHarnessInput,
  plan: SearchPlan,
  toolEvidence: ToolEvidenceBundle,
): Promise<string> {
  const detailContext = toolEvidence.toolResults.find((result) => result.type === 'paper_detail')?.text ?? ''
  const messages: ChatMessage[] = [
    ...input.history,
    {
      role: 'user',
      content: `${formatSynthesisContextPack(input, plan, {
        toolResults: toolEvidence.toolResults,
        warnings: toolEvidence.warnings,
      })}\n\n---\n\n${buildPaperDetailUserPrompt(input.userText, plan, detailContext)}`,
    },
  ]
  return chatWithAgentModel(messages, 'synthesizer', input.signal)
}

async function synthesizePaperPreview(
  input: RunResearchHarnessInput,
  plan: SearchPlan,
  preview: PaperPreviewData,
  toolEvidence: ToolEvidenceBundle,
): Promise<string> {
  const previewContext = toolEvidence.toolResults.find((result) => result.type === 'paper_preview')?.text ?? preview.text
  const messages: ChatMessage[] = [
    ...input.history,
    {
      role: 'user',
      content: `${formatSynthesisContextPack(input, plan, {
        toolResults: toolEvidence.toolResults,
        warnings: toolEvidence.warnings,
      })}\n\n---\n\n${buildPaperPreviewUserPrompt(input.userText, plan, previewContext)}`,
    },
  ]
  return chatWithAgentModel(messages, 'local_paper_analysis', input.signal)
}

async function synthesizeEvidenceAnswer(
  input: RunResearchHarnessInput,
  plan: SearchPlan,
  toolEvidence: ToolEvidenceBundle,
  mode: 'search_evidence' | 'deep_research',
  reflection?: SearchReflection,
): Promise<string> {
  const notes = toolEvidence.evidence
  const messages: ChatMessage[] = [
    ...input.history,
    {
      role: 'user',
      content: `${formatSynthesisContextPack(input, plan, {
        toolResults: toolEvidence.toolResults,
        evidence: notes,
        warnings: toolEvidence.warnings,
      })}\n\n---\n\n${buildEvidenceSynthesisUserPrompt(input.userText, plan, notes, { mode, reflection })}`,
    },
  ]
  return chatWithAgentModel(messages, 'local_paper_analysis', input.signal)
}

function formatSearchResultSetSummary(resultSet: SearchResultSet): string {
  const meta = [
    resultSet.mode ? `模式 ${resultSet.mode}` : null,
    resultSet.fromDate || resultSet.untilDate ? `日期 ${resultSet.fromDate ?? '?'} 至 ${resultSet.untilDate ?? '?'}` : null,
    typeof resultSet.totalAvailable === 'number' ? `可用 ${resultSet.totalAvailable}` : null,
    typeof resultSet.fetched === 'number' ? `本次取回 ${resultSet.fetched}` : null,
  ].filter(Boolean).join('；')
  const suffix = meta ? `（${meta}）` : ''
  return `已保存为结果集 **${resultSet.label}**${suffix}。后续可以直接说“${resultSet.label} 前 5 篇”或“${resultSet.label}-1 的链接”。`
}

function formatStableResultNumbers(resultSet: SearchResultSet): string {
  if (resultSet.results.length === 0) return ''
  const lines = resultSet.results.slice(0, 12).map((paper, index) => `${resultSet.label}-${index + 1}. ${paper.title}`)
  return `稳定编号：\n${lines.join('\n')}`
}

function withResultSetSummary(reply: string, resultSet?: SearchResultSet): string {
  if (!resultSet) return reply
  const stableNumbers = formatStableResultNumbers(resultSet)
  return `${formatSearchResultSetSummary(resultSet)}${stableNumbers ? `\n\n${stableNumbers}` : ''}\n\n${reply}`
}

function toResolvedResultSetReferenceContext(
  reference: NonNullable<ReturnType<typeof resolveResultSetReference>['data']>,
): ResolvedResultSetReferenceContext {
  return {
    resultSetId: reference.resultSet.id,
    resultSetLabel: reference.resultSet.label,
    query: reference.resultSet.query,
    indices: reference.indices,
    stableIndices: reference.indices.map((index) => `${reference.resultSet.label}-${index}`),
    papers: reference.papers.map((paper, index) => ({
      stableIndex: `${reference.resultSet.label}-${reference.indices[index] ?? index + 1}`,
      title: paper.title,
      doi: paper.doi,
      sourceUrl: paper.source_url,
      openAccessUrl: paper.open_access_pdf_url ?? paper.open_access_url ?? undefined,
    })),
  }
}

function forceResolvedReferencePlan(plan: SearchPlan): SearchPlan {
  return {
    ...plan,
    target: 'resolved_result_set_items',
    shouldSearch: false,
    queries: [],
  }
}

async function previewEvidencePapers(
  input: RunResearchHarnessInput,
  trace: ReturnType<typeof createAgentRun>,
  papers: PaperPreviewData['paper'][],
  stepName: string,
): Promise<PaperEvidenceNote[]> {
  return recordAgentStep(
    trace,
    'tool',
    stepName,
    { papers: papers.map((paper) => ({ title: paper.title, doi: paper.doi, openAccessPdfUrl: paper.open_access_pdf_url ?? paper.open_access_url })) },
    async () => previewPapersAsEvidence(papers, previewSearchResultPaper, input.signal),
  )
}

async function runSearchPipeline(
  input: RunResearchHarnessInput,
  trace: ReturnType<typeof createAgentRun>,
  plan: SearchPlan,
): Promise<{
  batches: SearchBatch[]
  reflection: SearchReflection
  searchResults: PaperPreviewData['paper'][]
}> {
  return runAcademicSearchTool({
    userText: input.userText,
    plan,
    search: (searchPlan, phase) => recordAgentStep(
      trace,
      'tool',
      phase === 'retry' ? 'academic_search_retry' : 'academic_search',
      phase === 'retry'
        ? { queries: searchPlan.queries }
        : { queries: searchPlan.queries, timeRange: searchPlan.timeRange, sortMode: searchPlan.sortMode },
      () => runAcademicSearches(searchPlan, input.signal),
    ),
    reflect: (userText, searchPlan, batches) => recordAgentStep(
      trace,
      'sensor',
      'reflect_on_search_results',
      { userText, plan: searchPlan, resultCount: batches.reduce((sum, batch) => sum + batch.results.length, 0) },
      () => reflectOnSearchResults(userText, searchPlan, batches, input.signal),
    ),
    merge: mergeSearchBatches,
  })
}

export async function runResearchHarness(input: RunResearchHarnessInput): Promise<ResearchAgentResult> {
  const loadedContext = loadResearchContext(input)
  const retrievedObjects = retrieveActiveResearchObjects(loadedContext)
  input = applyRetrievedResearchObjects(input, retrievedObjects)
  const trace = createAgentRun(input.userText)
  let plan: SearchPlan
  const paperReferenceContext = {
    currentPaper: input.context.currentPaper,
    lastSearchResults: input.context.lastSearchResults,
    activeSearchResultSetId: input.context.activeSearchResultSetId,
    recentSearchResultSets: input.context.recentSearchResultSets,
  }
  const preResolvedResultSetRef = shouldForceNewSearch(input.userText)
    ? { ok: false as const }
    : resolveResultSetReference(input.userText, paperReferenceContext, 5)
  const plannerInput = preResolvedResultSetRef.ok && preResolvedResultSetRef.data
    ? {
        ...input,
        context: {
          ...input.context,
          resolvedResultSetReference: toResolvedResultSetReferenceContext(preResolvedResultSetRef.data),
        },
      }
    : input

  try {
    const resolvedQuestion = await recordAgentStep(
      trace,
      'tool',
      'resolve_user_question',
      {
        userText: input.userText,
        activeSearchResultSetId: input.context.activeSearchResultSetId,
        currentPaperTitle: input.context.currentPaper?.title,
      },
      async () => resolveUserQuestion(plannerInput),
    )
    const inputWithResolvedQuestion: RunResearchHarnessInput = {
      ...plannerInput,
      context: {
        ...plannerInput.context,
        resolvedQuestion,
      },
    }
    const compression = await recordAgentStep(
      trace,
      'sensor',
      'context_compression_budget',
      { recentMessageCount: inputWithResolvedQuestion.recentMessages.length, maxTokens: 1_000_000 },
      async () => maybeCompressChatHistory(inputWithResolvedQuestion, { maxTokens: 1_000_000 }),
    )
    input = {
      ...inputWithResolvedQuestion,
      recentMessages: compression.messages,
    }
    await recordAgentStep(
      trace,
      'tool',
      'planner_context_pack',
      {
        resolvedQuestion: input.context.resolvedQuestion,
        compressionApplied: compression.compressionApplied,
      },
      async () => buildPlannerContextPack(input, resolvedQuestion, {
        intent: 'answer',
        shouldSearch: false,
        queries: [],
        target: resolvedQuestion.referencedPapers?.length ? 'resolved_result_set_items' : 'none',
      }),
    )

    if (detectResearchJudgmentRequest(input.userText)) {
      const reportInput = extractResearchJudgmentInput(input.userText)
      if (reportInput) {
        plan = {
          intent: 'deep_research',
          shouldSearch: false,
          queries: [],
          evidenceRequirement: 'multi_pdf_required',
          reason: 'research_judgment_analysis_mode',
        }
        const previews = await recordAgentStep(
          trace,
          'tool',
          'research_judgment_pdf_preview',
          { papers: reportInput.papers.map((paper) => ({ title: paper.title, url: paper.url })) },
          async () => previewResearchJudgmentPapers(reportInput, previewSearchResultPaper, input.signal),
        )
        const toolEvidence = createResearchJudgmentEvidenceBundle(plan, reportInput, previews)
        const report = await recordAgentStep(
          trace,
          'model',
          'synthesize_research_judgment_report',
          { topic: reportInput.topic, paperCount: toolEvidence.evidence.length },
          async () => synthesizeResearchJudgmentReport(reportInput, toolEvidence),
        )
        finishAgentRun(trace)
        return {
          reply: report,
          searched: false,
          plan,
          searchResults: toolEvidence.searchResults,
          currentPaper: toolEvidence.currentPaper,
          currentPaperEvidenceLevel: toolEvidence.currentPaperEvidenceLevel,
          paperEvidenceNotes: toolEvidence.evidence,
          deepResearchReport: toolEvidence.deepResearchReport,
          trace,
        }
      }
    }

    if (resolvedQuestion.ambiguity) {
      plan = {
        intent: 'clarify',
        shouldSearch: false,
        queries: [],
        response: resolvedQuestion.ambiguity,
        reason: 'ambiguous_reference',
      }
      const toolEvidence = createReplyOverrideEvidenceBundle('clarify', plan, resolvedQuestion.ambiguity)
      finishAgentRun(trace)
      return { reply: toolEvidence.replyOverride ?? resolvedQuestion.ambiguity, searched: false, plan, trace }
    }

    if (
      resolvedQuestion.referencedResultSetLabel
      && resolvedQuestion.referencedPapers?.length
      && resolvedQuestion.referencedPaperIndices?.length
      && isResultSetLinkRequest(input.userText)
      && !shouldForceNewSearch(input.userText)
    ) {
      const resultSet = input.context.recentSearchResultSets?.find((set) => set.id === resolvedQuestion.referencedResultSetId)
      const plan: SearchPlan = {
        intent: 'paper_detail',
        shouldSearch: false,
        queries: [],
        target: 'resolved_result_set_items',
        evidenceRequirement: 'metadata_ok',
        reason: 'resolved_question_result_set_link_request',
      }
      const toolEvidence = createResultSetLinksEvidenceBundle(
        plan,
        resolvedQuestion.referencedResultSetLabel,
        resolvedQuestion.referencedPapers,
        resolvedQuestion.referencedPaperIndices,
        resultSet?.results ?? resolvedQuestion.referencedPapers,
      )
      finishAgentRun(trace)
      return {
        reply: toolEvidence.replyOverride ?? '',
        searched: false,
        plan,
        searchResults: toolEvidence.searchResults,
        sourceResultSetId: resolvedQuestion.referencedResultSetId,
        currentPaper: toolEvidence.currentPaper,
        currentPaperEvidenceLevel: toolEvidence.currentPaperEvidenceLevel,
        trace,
      }
    }

    if (
      preResolvedResultSetRef.ok
      && preResolvedResultSetRef.data
      && isResultSetLinkRequest(input.userText)
      && !shouldForceNewSearch(input.userText)
    ) {
      const { resultSet, papers, indices } = preResolvedResultSetRef.data
      const plan: SearchPlan = {
        intent: 'paper_detail',
        shouldSearch: false,
        queries: [],
        target: 'resolved_result_set_items',
        evidenceRequirement: 'metadata_ok',
        reason: 'deterministic_result_set_link_request',
      }
      const toolEvidence = createResultSetLinksEvidenceBundle(plan, resultSet.label, papers, indices, resultSet.results)
      finishAgentRun(trace)
      return {
        reply: toolEvidence.replyOverride ?? '',
        searched: false,
        plan,
        searchResults: toolEvidence.searchResults,
        sourceResultSetId: resultSet.id,
        currentPaper: toolEvidence.currentPaper,
        currentPaperEvidenceLevel: toolEvidence.currentPaperEvidenceLevel,
        trace,
      }
    }

    try {
      plan = await recordAgentStep(
        trace,
        'guide',
        'plan_research_action',
        {
          userText: input.userText,
          recentMessages: input.recentMessages,
          resolvedResultSetReference: plannerInput.context.resolvedResultSetReference,
          resolvedQuestion: input.context.resolvedQuestion,
        },
        () => planResearchAction(input),
      )
    } catch (error) {
      if (!isMissingAiConfigError(error)) throw error
      plan = {
        intent: 'clarify',
        shouldSearch: false,
        queries: [],
        reason: 'missing_ai_config',
      }
      const reply = '搜索 Agent 需要先连接一个 AI 模型，才能理解你的意图、改写检索 query、判断结果是否相关。请先在设置里配置 API Key；配置后它不会再把“搜索结果不准确”这类反馈当作关键词去搜。'
      const toolEvidence = createReplyOverrideEvidenceBundle('clarify', plan, reply)
      finishAgentRun(trace)
      return { reply: toolEvidence.replyOverride ?? reply, searched: false, plan, trace }
    }

    if (preResolvedResultSetRef.ok && preResolvedResultSetRef.data && !shouldForceNewSearch(input.userText)) {
      plan = forceResolvedReferencePlan(plan)
    }

    if (!(preResolvedResultSetRef.ok && preResolvedResultSetRef.data) && looksLikeExternalSearchRequest(input.userText)) {
      const guardedPlan = await recordAgentStep(
        trace,
        'guide',
        'tool_runtime_guard',
        { userText: input.userText, originalIntent: plan.intent, originalShouldSearch: plan.shouldSearch },
        async () => deterministicExternalSearchPlan(input, plan),
      )
      if (guardedPlan) plan = guardedPlan
    }

    if (plan.intent === 'feedback') {
      const reply = plan.response || '收到，这属于对上一轮搜索质量的反馈。我会调整查询规划和结果评估，不会把这句话本身当成检索关键词。'
      const toolEvidence = createReplyOverrideEvidenceBundle('feedback', plan, reply)
      finishAgentRun(trace)
      return { reply: toolEvidence.replyOverride ?? reply, searched: false, plan, trace }
    }

    if (plan.intent === 'clarify') {
      const reply = plan.response || '你想让我优先搜索哪一类论文或哪个具体主题？'
      const toolEvidence = createReplyOverrideEvidenceBundle('clarify', plan, reply)
      finishAgentRun(trace)
      return { reply: toolEvidence.replyOverride ?? reply, searched: false, plan, trace }
    }

    const existingResultSetRef = preResolvedResultSetRef.ok ? preResolvedResultSetRef : resolveResultSetReference(input.userText, paperReferenceContext, 5)
    if (
      existingResultSetRef.ok
      && existingResultSetRef.data
      && isResultSetLinkRequest(input.userText)
      && !shouldForceNewSearch(input.userText)
    ) {
      const { resultSet, papers, indices } = existingResultSetRef.data
      const toolEvidence = createResultSetLinksEvidenceBundle({ ...plan, shouldSearch: false }, resultSet.label, papers, indices, resultSet.results)
      finishAgentRun(trace)
      return {
        reply: toolEvidence.replyOverride ?? '',
        searched: false,
        plan: { ...plan, shouldSearch: false },
        searchResults: toolEvidence.searchResults,
        sourceResultSetId: resultSet.id,
        currentPaper: toolEvidence.currentPaper,
        currentPaperEvidenceLevel: toolEvidence.currentPaperEvidenceLevel,
        trace,
      }
    }

    if (plan.response && plan.intent === 'answer') {
      const toolEvidence = createNoToolEvidenceBundle(plan)
      finishAgentRun(trace)
      return { reply: toolEvidence.replyOverride ?? plan.response, searched: false, plan, trace }
    }

    if (plan.intent === 'import_to_library') {
      const resolved = recordAgentStep(
        trace,
        'tool',
        'resolve_paper_reference',
        {
          paperReference: plan.paperReference,
          currentPaperTitle: input.context.currentPaper?.title,
          lastSearchResultCount: input.context.lastSearchResults?.length ?? 0,
        },
        async () => resolvePaperFromCurrentTurn(plan, input.userText, paperReferenceContext, input.context.resolvedQuestion),
      )
      const result = await resolved
      const paperLine = result.ok && result.data ? `\n\n识别到目标论文：《${result.data.title}》。` : ''
      const reply = `我识别到这是“导入/保存到文献库”的显式请求，但本阶段还没有把外部搜索结果一键写入永久文献库的安全流程接好，所以我不会自动保存或下载到本地文献库。${paperLine}\n\n目前可以先用 paper preview 做临时阅读；要永久保存，请在文献库里手动导入你已确认的 PDF。`
      const toolEvidence = createReplyOverrideEvidenceBundle('import_to_library', plan, reply)
      finishAgentRun(trace)
      return { reply: toolEvidence.replyOverride ?? reply, searched: false, plan, searchResults: input.context.lastSearchResults, trace }
    }

    if (plan.intent === 'deep_research') {
      const limit = requestedEvidencePaperCount(input.userText, { ...plan, evidenceRequirement: plan.evidenceRequirement ?? 'multi_pdf_required' })
      const existingRef = shouldForceNewSearch(input.userText)
        ? { ok: false as const }
        : preResolvedResultSetRef.ok
          ? preResolvedResultSetRef
          : resolveResultSetReference(input.userText, paperReferenceContext, limit)
      let searchResults = existingRef.ok && existingRef.data
        ? existingRef.data.resultSet.results
        : input.context.lastSearchResults ?? []
      let reflection: SearchReflection | undefined
      let searchResultSet: SearchResultSet | undefined
      let searchBatches: SearchBatch[] = []
      let searched = false

      if (!existingRef.ok && ((plan.shouldSearch && plan.queries.length > 0) || (searchResults.length === 0 && plan.queries.length > 0))) {
        const search = await runSearchPipeline(input, trace, plan)
        searchResults = search.searchResults
        reflection = search.reflection
        searchBatches = search.batches
        searchResultSet = createSearchResultSetFromBatches({
          userText: input.userText,
          nextSearchResultSetLabel: input.context.nextSearchResultSetLabel,
          plan,
          batches: search.batches,
          results: searchResults,
        })
        searched = true
      }

      const resolved = existingRef.ok && existingRef.data
        ? { ok: true as const, data: existingRef.data.papers }
        : resolvePapersFromCurrentTurn(
          plan,
          input.userText,
          {
            currentPaper: paperReferenceContext.currentPaper,
            lastSearchResults: searchResults,
            activeSearchResultSetId: paperReferenceContext.activeSearchResultSetId,
            recentSearchResultSets: paperReferenceContext.recentSearchResultSets,
          },
          input.context.resolvedQuestion,
          limit,
        )
      if (!resolved.ok || !resolved.data || resolved.data.length === 0) {
        finishAgentRun(trace)
        return {
          reply: resolved.error ?? '我还不能确定要深读哪几篇论文。请先搜索，或用“第 1、2、3 篇”指定。',
          searched,
          plan: { ...plan, intent: 'clarify', response: resolved.error },
          searchResults,
          trace,
        }
      }

      const selectedPapers = resolved.data.slice(0, limit)
      const notes = await previewEvidencePapers(input, trace, selectedPapers, 'deep_research_preview_papers')
      const deepResearchReport = buildDeepResearchReportArtifact(
        input.userText,
        notes,
        existingRef.ok && existingRef.data
          ? { resultSetId: existingRef.data.resultSet.id, indices: existingRef.data.indices }
          : undefined,
      )
      const toolEvidence = createDeepResearchEvidenceBundle(plan, {
        batches: searchBatches,
        searchResults,
        searchResultSet,
        evidence: notes,
        deepResearchReport,
      })
      const reply = await recordAgentStep(
        trace,
        'model',
        'synthesize_deep_research',
        { paperCount: notes.length, evidenceLevels: notes.map((note) => note.evidenceLevel), reflection },
        () => synthesizeEvidenceAnswer(input, plan, toolEvidence, 'deep_research', reflection),
      )
      finishAgentRun(trace)
      return {
        reply: withResultSetSummary(reply, toolEvidence.searchResultSet),
        searched,
        plan,
        searchResults: toolEvidence.searchResults,
        searchResultSet: toolEvidence.searchResultSet,
        searchResultSetLabel: toolEvidence.searchResultSet?.label,
        currentPaper: toolEvidence.currentPaper,
        currentPaperEvidenceLevel: toolEvidence.currentPaperEvidenceLevel,
        paperEvidenceNotes: toolEvidence.evidence,
        deepResearchReport: toolEvidence.deepResearchReport,
        sourceResultSetId: existingRef.ok && existingRef.data ? existingRef.data.resultSet.id : undefined,
        trace,
      }
    }

    if (plan.intent === 'paper_detail') {
      const resolved = await recordAgentStep(
        trace,
        'tool',
        'resolve_paper_reference',
        {
          paperReference: plan.paperReference,
          currentPaperTitle: input.context.currentPaper?.title,
          lastSearchResultCount: input.context.lastSearchResults?.length ?? 0,
        },
        async () => resolvePaperFromCurrentTurn(plan, input.userText, paperReferenceContext, input.context.resolvedQuestion),
      )
      if (!resolved.ok || !resolved.data) {
        finishAgentRun(trace)
        return {
          reply: resolved.error ?? '我还不能确定你指的是哪一篇论文，请告诉我是第几篇。',
          searched: false,
          plan: { ...plan, intent: 'clarify', response: resolved.error },
          searchResults: input.context.lastSearchResults,
          trace,
        }
      }

      const toolEvidence = await recordAgentStep(
        trace,
        'tool',
        'paper_detail',
        { title: resolved.data.title, doi: resolved.data.doi, evidenceLevel: resolved.data.abstract_text ? 'abstract' : 'metadata' },
        async () => runPaperDetailTool(plan, resolved.data!, formatPaperDetailContext),
      )
      const reply = await recordAgentStep(
        trace,
        'model',
        'synthesize_paper_detail',
        { title: resolved.data.title },
        () => synthesizePaperDetail(input, plan, toolEvidence),
      )
      finishAgentRun(trace)
      return {
        reply,
        searched: false,
        plan,
        searchResults: input.context.lastSearchResults,
        currentPaper: toolEvidence.currentPaper,
        currentPaperEvidenceLevel: toolEvidence.currentPaperEvidenceLevel,
        trace,
      }
    }

    if (plan.intent === 'paper_preview') {
      const resolved = await recordAgentStep(
        trace,
        'tool',
        'resolve_paper_reference',
        {
          paperReference: plan.paperReference,
          currentPaperTitle: input.context.currentPaper?.title,
          lastSearchResultCount: input.context.lastSearchResults?.length ?? 0,
        },
        async () => resolvePaperFromCurrentTurn(plan, input.userText, paperReferenceContext, input.context.resolvedQuestion),
      )
      if (!resolved.ok || !resolved.data) {
        finishAgentRun(trace)
        return {
          reply: resolved.error ?? '我还不能确定你指的是哪一篇论文，请告诉我是第几篇。',
          searched: false,
          plan: { ...plan, intent: 'clarify', response: resolved.error },
          searchResults: input.context.lastSearchResults,
          trace,
        }
      }

      const toolEvidence = await recordAgentStep(
        trace,
        'tool',
        'paper_preview',
        {
          title: resolved.data.title,
          doi: resolved.data.doi,
          openAccessUrl: resolved.data.open_access_pdf_url ?? resolved.data.open_access_url,
          libraryImport: false,
        },
        () => runPaperPreviewTool(plan, resolved.data!, previewSearchResultPaper, input.signal),
      )
      const reply = await recordAgentStep(
        trace,
        'model',
        'synthesize_paper_preview',
        {
          title: resolved.data.title,
          evidenceLevel: toolEvidence.currentPaperEvidenceLevel,
          cacheHit: toolEvidence.evidence[0]?.cacheHit,
        },
        () => synthesizePaperPreview(input, plan, {
          paper: toolEvidence.currentPaper ?? resolved.data!,
          evidenceLevel: toolEvidence.currentPaperEvidenceLevel ?? 'metadata_only',
          text: toolEvidence.evidence[0]?.text ?? '',
          cacheHit: toolEvidence.evidence[0]?.cacheHit ?? false,
          pdfCacheHit: toolEvidence.evidence[0]?.pdfCacheHit ?? false,
          message: toolEvidence.evidence[0]?.warning,
        }, toolEvidence),
      )
      finishAgentRun(trace)
      return {
        reply,
        searched: false,
        plan,
        searchResults: input.context.lastSearchResults,
        currentPaper: toolEvidence.currentPaper,
        currentPaperEvidenceLevel: toolEvidence.currentPaperEvidenceLevel,
        paperEvidenceNotes: toolEvidence.evidence,
        trace,
      }
    }

    if (plan.intent === 'local_research') {
      const paperQuery = plan.localPaperRequest?.query || input.userText
      const toolEvidence = await recordAgentStep(
        trace,
        'tool',
        'read_local_papers',
        { userText: input.userText, localPaperRequest: plan.localPaperRequest },
        async () => runLocalResearchTool(plan, paperQuery, input.loadLocalPaperContext),
      )
      const paperContext = toolEvidence.toolResults.find((result) => result.type === 'local_papers')?.text ?? ''
      const localHistory: ChatMessage[] = [
        ...input.history.slice(0, -1),
        {
          role: 'user',
          content: `${formatSynthesisContextPack(input, plan, {
            toolResults: toolEvidence.toolResults,
            warnings: toolEvidence.warnings,
          })}\n\n---\n\n${paperContext ? input.userText + paperContext : input.userText}`,
          images: input.history[input.history.length - 1]?.images,
        },
      ]
      const reply = await recordAgentStep(
        trace,
        'model',
        'local_paper_analysis',
        { hasPaperContext: Boolean(paperContext) },
        () => chatWithAgentModel(localHistory, 'local_paper_analysis', input.signal),
      )
      finishAgentRun(trace)
      return { reply, searched: false, plan, trace }
    }

    if (!plan.shouldSearch) {
      const directHistory: ChatMessage[] = [
        ...input.history.slice(0, -1),
        {
          role: 'user',
          content: `${formatSynthesisContextPack(input, plan)}\n\n---\n\n${input.userText}`,
          images: input.history[input.history.length - 1]?.images,
        },
      ]
      const reply = await recordAgentStep(
        trace,
        'model',
        'direct_answer',
        { historyLength: input.history.length },
        () => chatWithAgentModel(directHistory, 'simple_answer', input.signal),
      )
      finishAgentRun(trace)
      return { reply, searched: false, plan, trace }
    }

    const { batches, reflection, searchResults } = await runSearchPipeline(input, trace, plan)
    const searchResultSet = createSearchResultSetFromBatches({
      userText: input.userText,
      nextSearchResultSetLabel: input.context.nextSearchResultSetLabel,
      plan,
      batches,
      results: searchResults,
    })

    if (requiresPrimarySource(input.userText, plan) && searchResults.length > 0) {
      const limit = requestedEvidencePaperCount(input.userText, plan)
      const selectedPapers = selectEvidencePapers(searchResults, limit)
      const notes = await previewEvidencePapers(input, trace, selectedPapers, 'academic_search_evidence_preview')
      const toolEvidence = createAcademicSearchEvidenceBundle(plan, {
        batches,
        searchResults,
        searchResultSet,
        evidence: notes,
      })
      const reply = await recordAgentStep(
        trace,
        'model',
        'synthesize_evidence_answer',
        { plan, reflection, paperCount: notes.length, evidenceLevels: notes.map((note) => note.evidenceLevel) },
        () => synthesizeEvidenceAnswer(input, plan, toolEvidence, 'search_evidence', reflection),
      )
      const risks = await recordAgentStep(
        trace,
        'sensor',
        'detect_answer_risks',
        { answerLength: reply.length },
        async () => detectAnswerRisks(reply, batches),
      )

      finishAgentRun(trace)
      return {
        reply: withResultSetSummary(reply, toolEvidence.searchResultSet),
        searched: true,
        plan,
        searchResults: toolEvidence.searchResults,
        searchResultSet: toolEvidence.searchResultSet,
        searchResultSetLabel: toolEvidence.searchResultSet?.label,
        currentPaper: toolEvidence.currentPaper,
        currentPaperEvidenceLevel: toolEvidence.currentPaperEvidenceLevel,
        paperEvidenceNotes: toolEvidence.evidence,
        reflection,
        risks,
        trace,
      }
    }

    const toolEvidence = createAcademicSearchEvidenceBundle(plan, {
      batches,
      searchResults,
      searchResultSet,
    })
    const reply = await recordAgentStep(
      trace,
      'model',
      'synthesize_answer',
      { plan, reflection, searchBatchCount: batches.length },
      () => synthesizeAnswer(input, plan, toolEvidence, reflection),
    )
    const risks = await recordAgentStep(
      trace,
      'sensor',
      'detect_answer_risks',
      { answerLength: reply.length },
      async () => detectAnswerRisks(reply, batches),
    )

    finishAgentRun(trace)
    return {
      reply: withResultSetSummary(reply, toolEvidence.searchResultSet),
      searched: true,
      plan,
      searchResults: toolEvidence.searchResults,
      searchResultSet: toolEvidence.searchResultSet,
      searchResultSetLabel: toolEvidence.searchResultSet?.label,
      reflection,
      risks,
      trace,
    }
  } catch (error) {
    failAgentRun(trace, error)
    throw error
  }
}
