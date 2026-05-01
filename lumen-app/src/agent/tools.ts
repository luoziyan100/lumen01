/**
 * [INPUT]: 依赖 services/search
 * [OUTPUT]: 对外提供 Research Harness 的学术搜索工具封装与结果格式化
 * [POS]: agent 模块的工具层，统一包装外部学术搜索能力
 */
import { formatSearchResults, searchPapers, type SearchResult } from '../services/search'
import type { SearchBatch, ToolResult } from './types'

function searchResultKey(result: SearchResult): string {
  if (result.doi) return `doi:${result.doi.toLowerCase()}`
  return `title:${result.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`
}

export function mergeSearchBatches(batches: SearchBatch[], limit: number): SearchResult[] {
  const byKey = new Map<string, SearchResult>()
  for (const result of batches.flatMap((batch) => batch.results)) {
    const key = searchResultKey(result)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { ...result, authors: [...result.authors] })
      continue
    }

    if (!existing.abstract_text) existing.abstract_text = result.abstract_text
    if (!existing.open_access_url) existing.open_access_url = result.open_access_url
    if (!existing.journal) existing.journal = result.journal
    if (!existing.doi) existing.doi = result.doi
    existing.citation_count = Math.max(existing.citation_count, result.citation_count)
    existing.quality_score = Math.max(existing.quality_score, result.quality_score)
    existing.is_top_journal ||= result.is_top_journal
    if (!existing.source.includes(result.source)) existing.source = `${existing.source} / ${result.source}`
  }

  return Array.from(byKey.values())
    .sort((a, b) => b.quality_score - a.quality_score)
    .slice(0, limit)
}

export async function academicSearchTool(query: string, limit = 10): Promise<ToolResult<SearchBatch>> {
  try {
    const response = await searchPapers(query, limit)
    return {
      ok: true,
      data: {
        query,
        total: response.total,
        results: response.results,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function runAcademicSearches(
  queries: string[],
  signal?: AbortSignal,
): Promise<ToolResult<SearchBatch[]>> {
  const batches: SearchBatch[] = []
  for (const query of queries) {
    if (signal?.aborted) {
      return { ok: false, error: 'aborted' }
    }

    const result = await academicSearchTool(query, 10)
    if (!result.ok || !result.data) {
      return { ok: false, error: result.error ?? `搜索失败：${query}` }
    }
    batches.push(result.data)
  }

  return { ok: true, data: batches }
}

export function formatSearchBatches(batches: SearchBatch[], limit = 12): string {
  const merged = mergeSearchBatches(batches, limit)
  if (merged.length === 0) return '未找到相关论文。'
  const queryList = batches.map((batch) => `- ${batch.query}（返回 ${batch.total} 条）`).join('\n')
  return `执行过的查询：\n${queryList}\n\n合并去重后的结果：\n\n${formatSearchResults(merged)}`
}
