/**
 * [INPUT]: 依赖 @tauri-apps/api/core 的 invoke
 * [OUTPUT]: 对外提供 citation CRUD
 * [POS]: services 层的引用关系管理，被 GraphPage 消费
 */
import { invoke } from '@tauri-apps/api/core'

export interface Citation {
  id: string
  citing_id: string
  cited_id: string
  context: string | null
  created_at: string | null
}

export interface CitationEdge {
  citing_id: string
  cited_id: string
  context: string | null
}

export async function addCitation(citingId: string, citedId: string, context?: string): Promise<void> {
  return invoke('add_citation', { citingId, citedId, context })
}

export async function bulkAddCitations(items: CitationEdge[]): Promise<number> {
  return invoke('bulk_add_citations', { items })
}

export async function listCitations(): Promise<Citation[]> {
  return invoke('list_citations')
}

export async function listPaperCitations(paperId: string): Promise<Citation[]> {
  return invoke('list_paper_citations', { paperId })
}

export async function deleteCitation(id: string): Promise<void> {
  return invoke('delete_citation', { id })
}

export async function deletePaperCitations(paperId: string): Promise<void> {
  return invoke('delete_paper_citations', { paperId })
}
