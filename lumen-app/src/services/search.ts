/**
 * [INPUT]: 依赖 services/tauri
 * [OUTPUT]: 对外提供 searchPapers, formatSearchResults
 * [POS]: services 层的学术论文搜索（通过 Rust 后端调用 OpenAlex / arXiv / Semantic Scholar / Crossref），被 ResearchPage 消费
 */
import { hasTauriInvoke, invokeTauri } from './tauri'

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
  journal: string | null
  doi: string | null
  is_top_journal: boolean
  quality_score: number
}

export interface SearchResponse {
  total: number
  results: SearchResult[]
}

export async function searchPapers(query: string, limit = 8): Promise<SearchResponse> {
  if (hasTauriInvoke()) {
    return invokeTauri<SearchResponse>('search_papers', { query, limit })
  }

  const params = new URLSearchParams({ query, limit: String(limit) })
  const res = await fetch(`/api/search-papers?${params.toString()}`)
  if (!res.ok) {
    throw new Error(`搜索请求失败 (${res.status}): ${await res.text()}`)
  }
  return res.json()
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return '未找到相关论文。'

  return results.map((r, i) => {
    const authors = r.authors.map((a) => a.name).slice(0, 3).join(', ')
    const authorsStr = r.authors.length > 3 ? `${authors} 等` : authors || '作者未知'
    const pdf = r.open_access_url ? `[PDF](${r.open_access_url})` : '无开放获取'
    const journal = r.journal ? ` · ${r.journal}` : ''
    const top = r.is_top_journal ? ' · 顶刊/高可信来源' : ''
    const doi = r.doi ? ` · DOI: ${r.doi}` : ''
    const link = r.source_url ? ` · [来源](${r.source_url})` : ''
    const abstract_ = r.abstract_text
      ? r.abstract_text.length > 250 ? r.abstract_text.slice(0, 250) + '...' : r.abstract_text
      : '无摘要'
    return `**${i + 1}. ${r.title}** [${r.source}]
${authorsStr}${r.year ? ` (${r.year})` : ''}${journal}${top} · 被引 ${r.citation_count} 次 · ${pdf}${doi}${link}
> ${abstract_}`
  }).join('\n\n')
}
