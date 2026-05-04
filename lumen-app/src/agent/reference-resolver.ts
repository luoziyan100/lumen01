/**
 * [INPUT]: 依赖 agent/tools 与 agent/types
 * [OUTPUT]: 对外提供 resolveUserQuestion 指代消解入口
 * [POS]: agent 模块的状态绑定层，在 planner 之前把用户指代绑定到结构化对象
 */
import {
  hasStrongResultSetAnchor,
  hasWeakPronounOnly,
  resolvePaperReference,
  resolveResultSetReference,
  shouldForceNewSearch,
} from './tools'
import type { SearchResult } from '../services/search'
import type { ResolvedUserQuestion, RunResearchHarnessInput } from './types'

function stablePaperList(label: string, indices: number[], papers: SearchResult[]): string {
  return papers
    .map((paper, index) => `${label}-${indices[index] ?? index + 1}《${paper.title}》`)
    .join('、')
}

function hasPaperPronoun(text: string): boolean {
  return /这篇|这个论文|这篇论文|那篇|该论文|刚才那篇|它(?!们)|这个/.test(text)
}

function hasExplicitPaperSemantics(text: string): boolean {
  return /论文|文献|paper|papers|DOI|doi|arXiv|PDF|pdf|摘要|方法|实验|结论|贡献|局限|作者|引用|期刊|全文/.test(text)
}

function hasExplicitCurrentPaperAnchor(text: string): boolean {
  return /这篇\s*(?:论文|paper|文献|文章)|该论文|当前论文|这篇文献|刚才那篇\s*(?:论文|文献|paper|文章)|这篇文章/i.test(text)
}

function recentTurnIsPaperFocused(input: RunResearchHarnessInput): boolean {
  const recent = input.recentMessages.slice(-2).map((message) => message.content).join('\n')
  if (!recent) return false
  const title = input.context.currentPaper?.title
  if (title) {
    const titleWords = title.toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/).filter((word) => word.length >= 4)
    if (titleWords.some((word) => recent.toLowerCase().includes(word))) return true
  }
  return /论文|文献|paper|papers|DOI|doi|arXiv|PDF|pdf|摘要|方法|实验|结论|证据来源/.test(recent)
}

export function resolveUserQuestion(input: RunResearchHarnessInput): ResolvedUserQuestion {
  const context = {
    currentPaper: input.context.currentPaper,
    lastSearchResults: input.context.lastSearchResults,
    activeSearchResultSetId: input.context.activeSearchResultSetId,
    recentSearchResultSets: input.context.recentSearchResultSets,
  }

  if (!shouldForceNewSearch(input.userText)) {
    const resultSetRef = resolveResultSetReference(input.userText, context, 5)
    if (resultSetRef.ok && resultSetRef.data) {
      const { resultSet, papers, indices } = resultSetRef.data
      return {
        originalText: input.userText,
        standaloneQuestion: `请基于结果集 ${resultSet.label} 中的 ${stablePaperList(resultSet.label, indices, papers)} 回答：${input.userText}`,
        referencedResultSetId: resultSet.id,
        referencedResultSetLabel: resultSet.label,
        referencedPaperIndices: indices,
        referencedPapers: papers,
        currentPaper: input.context.currentPaper ?? undefined,
        confidence: 0.95,
      }
    }

    const recentStableListRef = resolveRecentStableListReference(input)
    if (recentStableListRef) {
      const { resultSet, papers, indices } = recentStableListRef
      return {
        originalText: input.userText,
        standaloneQuestion: `请基于最近回答中列出的 ${stablePaperList(resultSet.label, indices, papers)} 回答：${input.userText}`,
        referencedResultSetId: resultSet.id,
        referencedResultSetLabel: resultSet.label,
        referencedPaperIndices: indices,
        referencedPapers: papers,
        currentPaper: input.context.currentPaper ?? undefined,
        confidence: 0.8,
      }
    }
  }

  if (hasWeakPronounOnly(input.userText) && !isResultSetLinkRequestWithRecentStableList(input)) {
    return {
      originalText: input.userText,
      standaloneQuestion: input.userText,
      currentPaper: input.context.currentPaper ?? undefined,
      confidence: 0.45,
    }
  }

  if (hasPaperPronoun(input.userText)) {
    const explicitCurrentPaperAnchor = hasExplicitCurrentPaperAnchor(input.userText)
    const barePronoun = /它(?!们)|这个(?!论文)|那篇/.test(input.userText)
    const recentPaperFocused = recentTurnIsPaperFocused(input)
    const strongResultSetAnchor = hasStrongResultSetAnchor(input.userText)
    const explicitPaperSemantics = hasExplicitPaperSemantics(input.userText)
    const shouldResolveAsPaper = strongResultSetAnchor
      || explicitCurrentPaperAnchor
      || (barePronoun && explicitPaperSemantics && recentPaperFocused)

    if (!shouldResolveAsPaper) {
      return {
        originalText: input.userText,
        standaloneQuestion: input.userText,
        confidence: 0.45,
      }
    }

    if (input.context.currentPaper && (explicitCurrentPaperAnchor || (barePronoun && recentPaperFocused))) {
      return {
        originalText: input.userText,
        standaloneQuestion: `请基于当前论文《${input.context.currentPaper.title}》回答：${input.userText}`,
        referencedPapers: [input.context.currentPaper],
        currentPaper: input.context.currentPaper,
        confidence: 0.9,
      }
    }

    const resolved = resolvePaperReference({ intent: 'paper_detail', shouldSearch: false, queries: [] }, input.userText, context)
    if (resolved.ok && resolved.data) {
      return {
        originalText: input.userText,
        standaloneQuestion: `请基于论文《${resolved.data.title}》回答：${input.userText}`,
        referencedPapers: [resolved.data],
        currentPaper: resolved.data,
        confidence: 0.8,
      }
    }

    return {
      originalText: input.userText,
      standaloneQuestion: input.userText,
      ambiguity: '用户明确引用了论文，但当前没有唯一论文对象。',
      confidence: 0.25,
    }
  }

  return {
    originalText: input.userText,
    standaloneQuestion: input.userText,
    currentPaper: input.context.currentPaper ?? undefined,
    confidence: 0.5,
  }
}

function isResultSetLinkRequestWithRecentStableList(input: RunResearchHarnessInput): boolean {
  if (!/(链接|地址|URL|网址|arXiv|PDF|pdf|doi|DOI|来源)/i.test(input.userText)) return false
  const lastAssistant = [...input.recentMessages].reverse().find((message) => message.role === 'assistant')
  return Boolean(lastAssistant && /\bR\s*[0-9]+\s*[-#：:]\s*[0-9]+\b/i.test(lastAssistant.content))
}

function resolveRecentStableListReference(input: RunResearchHarnessInput): {
  resultSet: NonNullable<RunResearchHarnessInput['context']['recentSearchResultSets']>[number]
  papers: SearchResult[]
  indices: number[]
} | null {
  if (!hasWeakPronounOnly(input.userText) || !isResultSetLinkRequestWithRecentStableList(input)) return null
  const lastAssistant = [...input.recentMessages].reverse().find((message) => message.role === 'assistant')
  if (!lastAssistant) return null

  const labelMatch = lastAssistant.content.match(/\bR\s*([0-9]+)\s*[-#：:]\s*([0-9]+)\b/i)
  if (!labelMatch) return null

  const label = `R${labelMatch[1]}`
  const resultSet = input.context.recentSearchResultSets?.find((set) => set.label.toLowerCase() === label.toLowerCase())
  if (!resultSet) return null

  const indices = Array.from(lastAssistant.content.matchAll(new RegExp(`\\b${label}\\s*[-#：:]\\s*([0-9]+)\\b`, 'gi')))
    .map((match) => Number(match[1]))
    .filter((index) => Number.isInteger(index) && index > 0)
  const uniqueIndices = Array.from(new Set(indices)).slice(0, 10)
  const papers = uniqueIndices
    .map((index) => resultSet.results[index - 1])
    .filter((paper): paper is SearchResult => Boolean(paper))

  return papers.length > 0 ? { resultSet, papers, indices: uniqueIndices.slice(0, papers.length) } : null
}
