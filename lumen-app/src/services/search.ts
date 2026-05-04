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
  open_access_pdf_url: string | null
  open_access_landing_url: string | null
  source_url: string
  source: string
  journal: string | null
  doi: string | null
  published_date: string | null
  is_top_journal: boolean
  quality_score: number
}

export interface SearchResponse {
  total: number
  results: SearchResult[]
  mode?: SearchMode
  totalAvailable?: number
  fetched?: number
  categories?: string[]
  fromDate?: string
  untilDate?: string
}

export type SearchMode = 'keyword_search' | 'paper_lookup' | 'recent_ai_feed' | 'arxiv_category_feed'
export type SearchSourceHint = 'all' | 'arxiv' | 'openalex' | 'semantic_scholar' | 'crossref'
export type CategoryPreset = 'ai' | 'llm' | 'vision' | 'robotics' | 'custom'

export interface SearchOptions {
  fromDate?: string
  untilDate?: string
  sortMode?: 'relevance' | 'newest' | 'balanced'
  searchMode?: SearchMode
  sourceHint?: SearchSourceHint
  categoryPreset?: CategoryPreset
  arxivCategories?: string[]
  feedLimit?: number
  includeTotalCount?: boolean
}

export async function searchPapers(
  query: string,
  limit = 8,
  options?: SearchOptions,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  if (hasTauriInvoke()) {
    return invokeTauri<SearchResponse>('search_papers', { query, limit, options: options ?? null })
  }

  const params = new URLSearchParams({ query, limit: String(limit) })
  if (options?.fromDate) params.set('fromDate', options.fromDate)
  if (options?.untilDate) params.set('untilDate', options.untilDate)
  if (options?.sortMode) params.set('sortMode', options.sortMode)
  if (options?.searchMode) params.set('searchMode', options.searchMode)
  if (options?.sourceHint) params.set('sourceHint', options.sourceHint)
  if (options?.categoryPreset) params.set('categoryPreset', options.categoryPreset)
  if (options?.arxivCategories?.length) params.set('arxivCategories', options.arxivCategories.join(','))
  if (options?.feedLimit) params.set('feedLimit', String(options.feedLimit))
  if (typeof options?.includeTotalCount === 'boolean') params.set('includeTotalCount', String(options.includeTotalCount))
  const res = await fetch(`/api/search-papers?${params.toString()}`, { signal })
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
    const pdfUrl = r.open_access_pdf_url ?? r.open_access_url
    const pdf = pdfUrl ? `[PDF](${pdfUrl})` : '无开放 PDF'
    const journal = r.journal ? ` · ${r.journal}` : ''
    const top = r.is_top_journal ? ' · 顶刊/高可信来源' : ''
    const doi = r.doi ? ` · DOI: ${r.doi}` : ''
    const link = r.source_url ? ` · [来源](${r.source_url})` : ''
    const date = r.published_date ?? (r.year ? String(r.year) : null)
    const abstract_ = r.abstract_text
      ? r.abstract_text.length > 250 ? r.abstract_text.slice(0, 250) + '...' : r.abstract_text
      : '无摘要'
    return `**${i + 1}. ${r.title}** [${r.source}]
${authorsStr}${date ? ` (${date})` : ''}${journal}${top} · 被引 ${r.citation_count} 次 · ${pdf}${doi}${link}
> ${abstract_}`
  }).join('\n\n')
}
