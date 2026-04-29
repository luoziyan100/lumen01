/**
 * [INPUT]: 依赖 @tauri-apps/api/core (invoke)
 * [OUTPUT]: 对外提供 searchPapers, formatSearchResults
 * [POS]: services 层的学术论文搜索（通过 Rust 后端调用 OpenAlex + arXiv），被 ResearchPage 消费
 */
import { invoke } from '@tauri-apps/api/core'

export interface SearchAuthor {
  name: string
}

export interface SearchResult {
  id: string
  title: string
  abstract_text: string | null
  authors: SearchAuthor[]
  year: number | null
  citation_count: number
  open_access_url: string | null
  source_url: string
  source: string
}

interface SearchResponse {
  total: number
  results: SearchResult[]
}

export async function searchPapers(query: string, limit = 8): Promise<SearchResponse> {
  return invoke('search_papers', { query, limit })
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return '未找到相关论文。'

  return results.map((r, i) => {
    const authors = r.authors.map((a) => a.name).slice(0, 3).join(', ')
    const authorsStr = r.authors.length > 3 ? `${authors} 等` : authors
    const pdf = r.open_access_url ? `[PDF](${r.open_access_url})` : '无开放获取'
    const abstract_ = r.abstract_text
      ? r.abstract_text.length > 250 ? r.abstract_text.slice(0, 250) + '...' : r.abstract_text
      : '无摘要'
    return `**${i + 1}. ${r.title}** [${r.source}]
${authorsStr}${r.year ? ` (${r.year})` : ''} · 被引 ${r.citation_count} 次 · ${pdf}
> ${abstract_}`
  }).join('\n\n')
}
