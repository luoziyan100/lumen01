/**
 * [INPUT]: 依赖 services/tauri
 * [OUTPUT]: 对外提供 addPaper, listPapers, getPaper, deletePaper
 * [POS]: services 层的论文数据操作，被 pages/LibraryPage 和 hooks 消费
 */
import { hasTauriInvoke, invokeTauri } from './tauri'

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

const PAPERS_KEY = 'lumen.dev.papers'

function readLocalPapers(): Paper[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(PAPERS_KEY)
    return raw ? JSON.parse(raw) as Paper[] : []
  } catch {
    return []
  }
}

function writeLocalPapers(papers: Paper[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(PAPERS_KEY, JSON.stringify(papers))
}

function newPaperId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `paper-${random}`
}

export async function addPaper(input: AddPaperInput): Promise<Paper> {
  if (hasTauriInvoke()) {
    return invokeTauri<Paper>('add_paper', { input })
  }

  const paper: Paper = {
    id: newPaperId(),
    title: input.title,
    authors: input.authors ?? null,
    year: input.year ?? null,
    abstract_: input.abstract_ ?? null,
    doi: input.doi ?? null,
    arxiv_id: input.arxiv_id ?? null,
    file_path: input.file_path,
    page_count: input.page_count ?? null,
    added_at: new Date().toISOString(),
    metadata: null,
  }
  writeLocalPapers([paper, ...readLocalPapers()])
  return paper
}

export async function listPapers(): Promise<Paper[]> {
  if (hasTauriInvoke()) {
    return invokeTauri<Paper[]>('list_papers')
  }

  return readLocalPapers()
}

export async function getPaper(id: string): Promise<Paper> {
  if (hasTauriInvoke()) {
    return invokeTauri<Paper>('get_paper', { id })
  }

  const paper = readLocalPapers().find((p) => p.id === id)
  if (!paper) throw new Error('论文不存在')
  return paper
}

export async function deletePaper(id: string): Promise<void> {
  if (hasTauriInvoke()) {
    return invokeTauri<void>('delete_paper', { id })
  }

  writeLocalPapers(readLocalPapers().filter((p) => p.id !== id))
}
