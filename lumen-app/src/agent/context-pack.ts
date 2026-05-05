/**
 * [INPUT]: 依赖 agent/types 与 tool-manifest
 * [OUTPUT]: 对外提供 Agent Context Pack 构造和格式化
 * [POS]: agent 模块的上下文打包层，把历史、对象、决策和证据整理给 planner/synthesizer
 */
import { TOOL_MANIFEST } from './tool-manifest.ts'
import type {
  AgentContextPack,
  ContextToolResult,
  PaperEvidenceNote,
  ResolvedUserQuestion,
  RunResearchHarnessInput,
  SearchBatch,
  SearchPlan,
  SearchResultSet,
} from './types.ts'

function activeResultSet(input: RunResearchHarnessInput): SearchResultSet | undefined {
  const sets = input.context.recentSearchResultSets ?? []
  return sets.find((set) => set.id === input.context.activeSearchResultSetId) ?? sets[0]
}

export function buildContextPack(
  input: RunResearchHarnessInput,
  resolvedQuestion: ResolvedUserQuestion,
  decision: SearchPlan,
  options: {
    toolResults?: ContextToolResult[]
    evidence?: PaperEvidenceNote[]
    warnings?: string[]
  } = {},
): AgentContextPack {
  return {
    originalUserText: input.userText,
    resolvedQuestion,
    decision,
    activeObjects: {
      currentPaper: resolvedQuestion.currentPaper ?? input.context.currentPaper ?? undefined,
      activeResultSet: activeResultSet(input),
      referencedPapers: resolvedQuestion.referencedPapers,
      recentResultSets: input.context.recentSearchResultSets,
    },
    toolResults: options.toolResults ?? [],
    evidence: options.evidence ?? [],
    constraints: [
      '不要编造没有出现在搜索结果、PDF preview 或本地文献中的事实。',
      'paper_preview 和 deep_research 默认只做临时读取，不导入永久文献库。',
      '如果证据只有 metadata/abstract，不要声称读过全文。',
      '明确外部搜索请求必须由 academic_search 工具处理，不能让 direct_answer 自我否定。',
    ],
    warnings: [
      ...(resolvedQuestion.ambiguity ? [resolvedQuestion.ambiguity] : []),
      ...(options.warnings ?? []),
    ],
  }
}

export const buildPlannerContextPack = buildContextPack
export const buildSynthesisContextPack = buildContextPack

export function formatContextPackForModel(pack: AgentContextPack): string {
  const referenced = pack.activeObjects.referencedPapers
    ?.map((paper, index) => {
      const stable = pack.resolvedQuestion.referencedResultSetLabel && pack.resolvedQuestion.referencedPaperIndices?.[index]
        ? `${pack.resolvedQuestion.referencedResultSetLabel}-${pack.resolvedQuestion.referencedPaperIndices[index]}`
        : `Paper ${index + 1}`
      return `- ${stable}: ${paper.title}
  DOI: ${paper.doi ?? '无'}
  Source: ${paper.source_url || '无'}
  PDF: ${paper.open_access_pdf_url ?? paper.open_access_url ?? '无'}`
    }).join('\n')

  const resultSets = shouldRenderRecentResultSets(pack)
    ? pack.activeObjects.recentResultSets
      ?.slice(0, 5)
      .map((set) => `- ${set.label}: ${set.query} (${set.results.length} results${set.totalAvailable ? `, total ${set.totalAvailable}` : ''})`)
      .join('\n')
    : ''

  const evidence = pack.evidence.map((note, index) => `- Paper ${index + 1}: ${note.paper.title}
  DOI: ${note.paper.doi ?? '无'}
  Source: ${note.paper.source_url || '无'}
  PDF: ${note.paper.open_access_pdf_url ?? note.paper.open_access_url ?? '无'}
  Evidence: ${note.evidenceLevel}
  Cache: text=${note.cacheHit ? 'hit' : 'miss'}, pdf=${note.pdfCacheHit ? 'hit' : 'miss'}
  Warning: ${note.warning ?? '无'}
  Evidence text:
${trimToolText(note.text)}`).join('\n')
  const toolResults = formatContextToolResults(pack.toolResults)

  return `## 用户原始输入
${pack.originalUserText}

## 指代消解后的本轮问题
${pack.resolvedQuestion.standaloneQuestion}

## 本轮决策
intent: ${pack.decision.intent}
target: ${pack.decision.target ?? 'none'}
evidenceRequirement: ${pack.decision.evidenceRequirement ?? 'unspecified'}
shouldSearch: ${pack.decision.shouldSearch}

## 已解析对象
${referenced || '无显式解析对象。'}

## 最近结果集
${resultSets || '无。本轮没有引用历史搜索结果。'}

## 工具 Manifest 边界
${TOOL_MANIFEST.map((tool) => `- ${tool.name}: ${tool.description}`).join('\n')}

## 工具执行结果 / 证据等级
${toolResults || '尚无工具结果。'}

## 证据等级与边界
${evidence || '尚无工具证据。'}

## 约束
${pack.constraints.map((item) => `- ${item}`).join('\n')}

## 警告
${pack.warnings.length > 0 ? pack.warnings.map((item) => `- ${item}`).join('\n') : '无。'}`
}

function shouldRenderRecentResultSets(pack: AgentContextPack): boolean {
  return Boolean(pack.activeObjects.referencedPapers?.length)
    || pack.decision.target === 'resolved_result_set_items'
    || pack.decision.intent === 'paper_detail'
    || pack.decision.intent === 'paper_preview'
    || pack.decision.intent === 'deep_research'
}

function formatContextToolResults(results: ContextToolResult[]): string {
  return results.map((result) => {
    if (result.type === 'search_batches') {
      return `### academic_search
${formatSearchBatchesForContext(result.batches)}`
    }
    if (result.type === 'paper_detail') {
      return `### paper_detail
${trimToolText(result.text)}`
    }
    if (result.type === 'paper_preview') {
      return `### paper_preview
Evidence level: ${result.evidenceLevel}
${trimToolText(result.text)}`
    }
    if (result.type === 'local_papers') {
      return `### read_local_papers
${trimToolText(result.text)}`
    }
    return `### ${result.title}
${trimToolText(result.text)}`
  }).join('\n\n')
}

function formatSearchBatchesForContext(batches: SearchBatch[]): string {
  if (batches.length === 0) return '没有搜索结果。'
  return batches.map((batch) => {
    const meta = [
      `query: ${batch.query}`,
      batch.mode ? `mode: ${batch.mode}` : null,
      batch.fromDate || batch.untilDate ? `date: ${batch.fromDate ?? '?'} to ${batch.untilDate ?? '?'}` : null,
      typeof batch.totalAvailable === 'number' ? `totalAvailable: ${batch.totalAvailable}` : null,
      `returned: ${batch.results.length}`,
    ].filter(Boolean).join('；')
    const papers = batch.results.slice(0, 12).map((paper, index) => `- ${index + 1}. ${paper.title}
  authors: ${paper.authors.map((author) => author.name).slice(0, 4).join(', ') || '未知'}
  date: ${paper.published_date ?? paper.year ?? '未知'}
  DOI: ${paper.doi ?? '无'}
  source: ${paper.source_url || '无'}
  PDF: ${paper.open_access_pdf_url ?? paper.open_access_url ?? '无'}
  abstract: ${paper.abstract_text?.slice(0, 500) ?? '无'}`).join('\n')
    return `#### ${batch.query}
${meta}
${papers}`
  }).join('\n\n')
}

function trimToolText(text: string): string {
  return text.length > 14_000 ? `${text.slice(0, 14_000)}\n[截断：工具结果过长]` : text
}
