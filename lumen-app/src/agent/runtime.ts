/**
 * [INPUT]: 依赖 agent/guides、agent/tools、agent/sensors、agent/prompts、services/ai
 * [OUTPUT]: 对外提供 runResearchHarness
 * [POS]: agent 模块的统一运行时，编排规划、工具、传感器、综合回答与本地 trace
 */
import { chatWithAgentModel, type ChatMessage } from '../services/ai'
import { formatPaperDetailContext, previewSearchResultPaper, type PaperPreviewData } from '../services/paper-preview'
import { deterministicExternalSearchPlan, looksLikeExternalSearchRequest, planResearchAction } from './guides'
import { buildEvidenceSynthesisUserPrompt, buildPaperDetailUserPrompt, buildPaperPreviewUserPrompt, buildSynthesisUserPrompt } from './prompts'
import { buildContextPack, formatContextPackForModel } from './context-pack'
import { maybeCompressChatHistory } from './compression'
import { resolveUserQuestion } from './reference-resolver'
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
  DeepResearchReportArtifact,
  PaperEvidenceNote,
  SearchBatch,
  SearchPlan,
  SearchReflection,
  SearchResultSet,
  ResolvedResultSetReferenceContext,
  ResolvedUserQuestion,
  ContextToolResult,
} from './types'

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
  return formatContextPackForModel(buildContextPack(
    input,
    input.context.resolvedQuestion ?? fallbackResolvedQuestion(input),
    plan,
    options,
  ))
}

async function synthesizeAnswer(
  input: RunResearchHarnessInput,
  plan: SearchPlan,
  batches: SearchBatch[],
  reflection?: SearchReflection,
): Promise<string> {
  const synthesisMessages: ChatMessage[] = [
    ...input.history,
    {
      role: 'user',
      content: `${formatSynthesisContextPack(input, plan, { toolResults: [{ type: 'search_batches', batches }] })}\n\n---\n\n${buildSynthesisUserPrompt(input.userText, plan, batches, reflection)}`,
    },
  ]

  return chatWithAgentModel(synthesisMessages, 'synthesizer', input.signal)
}

async function synthesizePaperDetail(
  input: RunResearchHarnessInput,
  plan: SearchPlan,
  detailContext: string,
): Promise<string> {
  const messages: ChatMessage[] = [
    ...input.history,
    {
      role: 'user',
      content: `${formatSynthesisContextPack(input, plan, { toolResults: [{ type: 'paper_detail', text: detailContext }] })}\n\n---\n\n${buildPaperDetailUserPrompt(input.userText, plan, detailContext)}`,
    },
  ]
  return chatWithAgentModel(messages, 'synthesizer', input.signal)
}

async function synthesizePaperPreview(
  input: RunResearchHarnessInput,
  plan: SearchPlan,
  preview: PaperPreviewData,
): Promise<string> {
  const previewContext = `证据来源：${preview.evidenceLevel}
临时文本缓存命中：${preview.cacheHit ? '是' : '否'}
临时 PDF 缓存命中：${preview.pdfCacheHit ? '是' : '否'}
边界：paper_preview 只做临时读取，不会加入文献库。
${preview.message ? `降级说明：${preview.message}\n` : ''}
${preview.text}`
  const messages: ChatMessage[] = [
    ...input.history,
    {
      role: 'user',
      content: `${formatSynthesisContextPack(input, plan, { toolResults: [{ type: 'paper_preview', text: previewContext, evidenceLevel: preview.evidenceLevel }] })}\n\n---\n\n${buildPaperPreviewUserPrompt(input.userText, plan, previewContext)}`,
    },
  ]
  return chatWithAgentModel(messages, 'local_paper_analysis', input.signal)
}

async function synthesizeEvidenceAnswer(
  input: RunResearchHarnessInput,
  plan: SearchPlan,
  notes: PaperEvidenceNote[],
  mode: 'search_evidence' | 'deep_research',
  reflection?: SearchReflection,
): Promise<string> {
  const messages: ChatMessage[] = [
    ...input.history,
    {
      role: 'user',
      content: `${formatSynthesisContextPack(input, plan, { evidence: notes })}\n\n---\n\n${buildEvidenceSynthesisUserPrompt(input.userText, plan, notes, { mode, reflection })}`,
    },
  ]
  return chatWithAgentModel(messages, 'local_paper_analysis', input.signal)
}

function previewToEvidenceNote(preview: PaperPreviewData): PaperEvidenceNote {
  return {
    paper: preview.paper,
    evidenceLevel: preview.evidenceLevel,
    text: preview.text,
    cacheHit: preview.cacheHit,
    pdfCacheHit: preview.pdfCacheHit,
    warning: preview.message,
  }
}

function buildDeepResearchReport(
  input: RunResearchHarnessInput,
  notes: PaperEvidenceNote[],
  source?: { resultSetId?: string; indices?: number[] },
): DeepResearchReportArtifact {
  return {
    query: input.userText,
    papers: notes.map((note, index) => ({
      paper: note.paper,
      title: note.paper.title,
      doi: note.paper.doi,
      source: note.paper.source,
      sourceResultSetId: source?.resultSetId,
      sourceResultIndex: source?.indices?.[index],
      evidenceLevel: note.evidenceLevel,
      cacheHit: note.cacheHit,
      pdfCacheHit: note.pdfCacheHit,
      warning: note.warning,
    })),
    createdAt: new Date().toISOString(),
  }
}

function newResultSetId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `rs-${random}`
}

function createSearchResultSet(
  input: RunResearchHarnessInput,
  plan: SearchPlan,
  batches: SearchBatch[],
  results: PaperEvidenceNote['paper'][],
): SearchResultSet {
  const primaryBatch = batches.find((batch) => batch.mode === 'recent_ai_feed' || batch.mode === 'arxiv_category_feed') ?? batches[0]
  const categories = Array.from(new Set(batches.flatMap((batch) => batch.categories ?? [])))
  const totalAvailable = primaryBatch?.totalAvailable
    ?? (batches.length > 0 ? batches.reduce((sum, batch) => sum + batch.total, 0) : undefined)
  const fetched = batches.length > 0
    ? batches.reduce((sum, batch) => sum + (batch.fetched ?? batch.results.length), 0)
    : results.length

  return {
    id: newResultSetId(),
    label: input.context.nextSearchResultSetLabel ?? 'R1',
    query: input.userText,
    plan,
    mode: primaryBatch?.mode ?? plan.searchMode,
    totalAvailable,
    fetched,
    categories: categories.length > 0 ? categories : undefined,
    fromDate: primaryBatch?.fromDate ?? plan.timeRange?.fromDate,
    untilDate: primaryBatch?.untilDate ?? plan.timeRange?.untilDate,
    results,
    createdAt: new Date().toISOString(),
  }
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

function formatResultSetLinks(
  label: string,
  papers: PaperEvidenceNote['paper'][],
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
  const previews = await recordAgentStep(
    trace,
    'tool',
    stepName,
    { papers: papers.map((paper) => ({ title: paper.title, doi: paper.doi, openAccessPdfUrl: paper.open_access_pdf_url ?? paper.open_access_url })) },
    async () => {
      const data: PaperPreviewData[] = []
      for (const paper of papers) {
        if (input.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
        data.push(await previewSearchResultPaper(paper, input.signal))
      }
      return data
    },
  )
  return previews.map(previewToEvidenceNote)
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
  const searchResult = await recordAgentStep(
    trace,
    'tool',
    'academic_search',
    { queries: plan.queries, timeRange: plan.timeRange, sortMode: plan.sortMode },
    () => runAcademicSearches(plan, input.signal),
  )
  if (!searchResult.ok || !searchResult.data) {
    throw new Error(searchResult.error ?? '学术搜索失败')
  }

  let batches = searchResult.data
  let reflection = await recordAgentStep(
    trace,
    'sensor',
    'reflect_on_search_results',
    { userText: input.userText, plan, resultCount: batches.reduce((sum, batch) => sum + batch.results.length, 0) },
    () => reflectOnSearchResults(input.userText, plan, batches, input.signal),
  )

  if (reflection.status === 'retry' && reflection.revisedQueries.length > 0) {
    const retryResult = await recordAgentStep(
      trace,
      'tool',
      'academic_search_retry',
      { queries: reflection.revisedQueries },
      () => runAcademicSearches({ ...plan, queries: reflection.revisedQueries, sortMode: 'newest' }, input.signal),
    )
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
    searchResults: mergeSearchBatches(batches, 12),
  }
}

export async function runResearchHarness(input: RunResearchHarnessInput): Promise<ResearchAgentResult> {
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
      'build_context_pack',
      {
        resolvedQuestion: input.context.resolvedQuestion,
        compressionApplied: compression.compressionApplied,
      },
      async () => buildContextPack(input, resolvedQuestion, {
        intent: 'answer',
        shouldSearch: false,
        queries: [],
        target: resolvedQuestion.referencedPapers?.length ? 'resolved_result_set_items' : 'none',
      }),
    )

    if (resolvedQuestion.ambiguity) {
      plan = {
        intent: 'clarify',
        shouldSearch: false,
        queries: [],
        response: resolvedQuestion.ambiguity,
        reason: 'ambiguous_reference',
      }
      finishAgentRun(trace)
      return { reply: resolvedQuestion.ambiguity, searched: false, plan, trace }
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
      const reply = formatResultSetLinks(
        resolvedQuestion.referencedResultSetLabel,
        resolvedQuestion.referencedPapers,
        resolvedQuestion.referencedPaperIndices,
      )
      finishAgentRun(trace)
      return {
        reply,
        searched: false,
        plan,
        searchResults: resultSet?.results,
        sourceResultSetId: resolvedQuestion.referencedResultSetId,
        currentPaper: resolvedQuestion.referencedPapers[0],
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
      const reply = formatResultSetLinks(resultSet.label, papers, indices)
      finishAgentRun(trace)
      return {
        reply,
        searched: false,
        plan,
        searchResults: resultSet.results,
        sourceResultSetId: resultSet.id,
        currentPaper: papers[0],
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
      finishAgentRun(trace)
      return { reply, searched: false, plan, trace }
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
      finishAgentRun(trace)
      return { reply, searched: false, plan, trace }
    }

    if (plan.intent === 'clarify') {
      const reply = plan.response || '你想让我优先搜索哪一类论文或哪个具体主题？'
      finishAgentRun(trace)
      return { reply, searched: false, plan, trace }
    }

    const existingResultSetRef = preResolvedResultSetRef.ok ? preResolvedResultSetRef : resolveResultSetReference(input.userText, paperReferenceContext, 5)
    if (
      existingResultSetRef.ok
      && existingResultSetRef.data
      && isResultSetLinkRequest(input.userText)
      && !shouldForceNewSearch(input.userText)
    ) {
      const { resultSet, papers, indices } = existingResultSetRef.data
      const reply = formatResultSetLinks(resultSet.label, papers, indices)
      finishAgentRun(trace)
      return {
        reply,
        searched: false,
        plan: { ...plan, shouldSearch: false },
        searchResults: resultSet.results,
        sourceResultSetId: resultSet.id,
        currentPaper: papers[0],
        trace,
      }
    }

    if (plan.response && plan.intent === 'answer') {
      finishAgentRun(trace)
      return { reply: plan.response, searched: false, plan, trace }
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
        async () => resolvePaperReference(plan, input.userText, paperReferenceContext),
      )
      const result = await resolved
      const paperLine = result.ok && result.data ? `\n\n识别到目标论文：《${result.data.title}》。` : ''
      const reply = `我识别到这是“导入/保存到文献库”的显式请求，但本阶段还没有把外部搜索结果一键写入永久文献库的安全流程接好，所以我不会自动保存或下载到本地文献库。${paperLine}\n\n目前可以先用 paper preview 做临时阅读；要永久保存，请在文献库里手动导入你已确认的 PDF。`
      finishAgentRun(trace)
      return { reply, searched: false, plan, searchResults: input.context.lastSearchResults, trace }
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
      let searched = false

      if (!existingRef.ok && ((plan.shouldSearch && plan.queries.length > 0) || (searchResults.length === 0 && plan.queries.length > 0))) {
        const search = await runSearchPipeline(input, trace, plan)
        searchResults = search.searchResults
        reflection = search.reflection
        searchResultSet = createSearchResultSet(input, plan, search.batches, searchResults)
        searched = true
      }

      const resolved = existingRef.ok && existingRef.data
        ? { ok: true as const, data: existingRef.data.papers }
        : resolvePaperReferences(
          plan,
          input.userText,
          {
            currentPaper: input.context.currentPaper,
            lastSearchResults: searchResults,
            activeSearchResultSetId: input.context.activeSearchResultSetId,
            recentSearchResultSets: input.context.recentSearchResultSets,
          },
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
      const reply = await recordAgentStep(
        trace,
        'model',
        'synthesize_deep_research',
        { paperCount: notes.length, evidenceLevels: notes.map((note) => note.evidenceLevel), reflection },
        () => synthesizeEvidenceAnswer(input, plan, notes, 'deep_research', reflection),
      )
      const deepResearchReport = buildDeepResearchReport(input, notes, existingRef.ok && existingRef.data
        ? { resultSetId: existingRef.data.resultSet.id, indices: existingRef.data.indices }
        : undefined)
      finishAgentRun(trace)
      return {
        reply: withResultSetSummary(reply, searchResultSet),
        searched,
        plan,
        searchResults,
        searchResultSet,
        searchResultSetLabel: searchResultSet?.label,
        currentPaper: notes[0]?.paper,
        currentPaperEvidenceLevel: notes[0]?.evidenceLevel,
        paperEvidenceNotes: notes,
        deepResearchReport,
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
        async () => resolvePaperReference(plan, input.userText, paperReferenceContext),
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

      const detailContext = await recordAgentStep(
        trace,
        'tool',
        'paper_detail',
        { title: resolved.data.title, doi: resolved.data.doi, evidenceLevel: resolved.data.abstract_text ? 'abstract' : 'metadata' },
        async () => formatPaperDetailContext(resolved.data!),
      )
      const reply = await recordAgentStep(
        trace,
        'model',
        'synthesize_paper_detail',
        { title: resolved.data.title },
        () => synthesizePaperDetail(input, plan, detailContext),
      )
      finishAgentRun(trace)
      return {
        reply,
        searched: false,
        plan,
        searchResults: input.context.lastSearchResults,
        currentPaper: resolved.data,
        currentPaperEvidenceLevel: resolved.data.abstract_text ? 'abstract_only' : 'metadata_only',
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
        async () => resolvePaperReference(plan, input.userText, paperReferenceContext),
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

      const preview = await recordAgentStep(
        trace,
        'tool',
        'paper_preview',
        {
          title: resolved.data.title,
          doi: resolved.data.doi,
          openAccessUrl: resolved.data.open_access_pdf_url ?? resolved.data.open_access_url,
          libraryImport: false,
        },
        () => previewSearchResultPaper(resolved.data!, input.signal),
      )
      const reply = await recordAgentStep(
        trace,
        'model',
        'synthesize_paper_preview',
        { title: resolved.data.title, evidenceLevel: preview.evidenceLevel, cacheHit: preview.cacheHit },
        () => synthesizePaperPreview(input, plan, preview),
      )
      finishAgentRun(trace)
      return {
        reply,
        searched: false,
        plan,
        searchResults: input.context.lastSearchResults,
        currentPaper: resolved.data,
        currentPaperEvidenceLevel: preview.evidenceLevel,
        trace,
      }
    }

    if (plan.intent === 'local_research') {
      const paperQuery = plan.localPaperRequest?.query || input.userText
      const paperContext = await recordAgentStep(
        trace,
        'tool',
        'read_local_papers',
        { userText: input.userText, localPaperRequest: plan.localPaperRequest },
        async () => input.loadLocalPaperContext ? input.loadLocalPaperContext(paperQuery) : '',
      )
      const localHistory: ChatMessage[] = [
        ...input.history.slice(0, -1),
        {
          role: 'user',
          content: `${formatSynthesisContextPack(input, plan, { toolResults: [{ type: 'local_papers', text: paperContext || '没有读取到本地论文内容。' }] })}\n\n---\n\n${paperContext ? input.userText + paperContext : input.userText}`,
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
    const searchResultSet = createSearchResultSet(input, plan, batches, searchResults)

    if (requiresPrimarySource(input.userText, plan) && searchResults.length > 0) {
      const limit = requestedEvidencePaperCount(input.userText, plan)
      const selectedPapers = selectEvidencePapers(searchResults, limit)
      const notes = await previewEvidencePapers(input, trace, selectedPapers, 'academic_search_evidence_preview')
      const reply = await recordAgentStep(
        trace,
        'model',
        'synthesize_evidence_answer',
        { plan, reflection, paperCount: notes.length, evidenceLevels: notes.map((note) => note.evidenceLevel) },
        () => synthesizeEvidenceAnswer(input, plan, notes, 'search_evidence', reflection),
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
        reply: withResultSetSummary(reply, searchResultSet),
        searched: true,
        plan,
        searchResults,
        searchResultSet,
        searchResultSetLabel: searchResultSet.label,
        currentPaper: notes[0]?.paper,
        currentPaperEvidenceLevel: notes[0]?.evidenceLevel,
        paperEvidenceNotes: notes,
        reflection,
        risks,
        trace,
      }
    }

    const reply = await recordAgentStep(
      trace,
      'model',
      'synthesize_answer',
      { plan, reflection, searchBatchCount: batches.length },
      () => synthesizeAnswer(input, plan, batches, reflection),
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
      reply: withResultSetSummary(reply, searchResultSet),
      searched: true,
      plan,
      searchResults,
      searchResultSet,
      searchResultSetLabel: searchResultSet.label,
      reflection,
      risks,
      trace,
    }
  } catch (error) {
    failAgentRun(trace, error)
    throw error
  }
}
