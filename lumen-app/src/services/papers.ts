/**
 * [INPUT]: 依赖 @tauri-apps/api/core 的 invoke
 * [OUTPUT]: 对外提供 addPaper, listPapers, getPaper, deletePaper
 * [POS]: services 层的论文数据操作，被 pages/LibraryPage 和 hooks 消费
 */
import { invoke } from '@tauri-apps/api/core'

export interface Paper {
  id: string
  title: string
  authors: string | null
  year: number | null
  abstract_: string | null
  doi: string | null
  arxiv_id: string | null
  file_path: string
  page_count: number | null
  added_at: string | null
  metadata: string | null
}

export interface AddPaperInput {
  title: string
  authors?: string
  year?: number
  abstract_?: string
  doi?: string
  arxiv_id?: string
  file_path: string
  page_count?: number
}

export async function addPaper(input: AddPaperInput): Promise<Paper> {
  return invoke('add_paper', { input })
}

export async function listPapers(): Promise<Paper[]> {
  return invoke('list_papers')
}

export async function getPaper(id: string): Promise<Paper> {
  return invoke('get_paper', { id })
}

export async function deletePaper(id: string): Promise<void> {
  return invoke('delete_paper', { id })
}
