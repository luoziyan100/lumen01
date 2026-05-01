/**
 * [INPUT]: 依赖 services/tauri
 * [OUTPUT]: 对外提供 research 项目 CRUD
 * [POS]: services 层的研究项目管理，被 ResearchPage 消费
 */
import { hasTauriInvoke, invokeTauri } from './tauri'

export interface ResearchProject {
  id: string
  name: string
  question: string | null
  status: string | null
  report: string | null
  created_at: string | null
  updated_at: string | null
  paper_count: number | null
}

export interface ResearchPaper {
  paper_id: string
  title: string
  authors: string | null
  file_path: string
}

export interface ResearchNote {
  id: string
  project_id: string
  role: string | null
  content: string
  created_at: string | null
}

const PROJECTS_KEY = 'lumen.dev.research.projects'
const NOTES_KEY = 'lumen.dev.research.notes'
const PAPERS_KEY = 'lumen.dev.research.paperIds'

function readLocal<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function writeLocal<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

function newId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${random}`
}

function readProjects(): ResearchProject[] {
  return readLocal<ResearchProject[]>(PROJECTS_KEY, [])
}

function writeProjects(projects: ResearchProject[]): void {
  writeLocal(PROJECTS_KEY, projects)
}

function readNotes(): ResearchNote[] {
  return readLocal<ResearchNote[]>(NOTES_KEY, [])
}

function writeNotes(notes: ResearchNote[]): void {
  writeLocal(NOTES_KEY, notes)
}

function readResearchPaperIds(): Record<string, string[]> {
  return readLocal<Record<string, string[]>>(PAPERS_KEY, {})
}

function writeResearchPaperIds(value: Record<string, string[]>): void {
  writeLocal(PAPERS_KEY, value)
}

function touchProject(projectId: string): void {
  const now = new Date().toISOString()
  const paperIds = readResearchPaperIds()
  writeProjects(readProjects().map((p) => (
    p.id === projectId
      ? { ...p, updated_at: now, paper_count: paperIds[projectId]?.length ?? p.paper_count ?? 0 }
      : p
  )))
}

export async function createResearchProject(name: string): Promise<ResearchProject> {
  if (hasTauriInvoke()) {
    return invokeTauri<ResearchProject>('create_research_project', { name })
  }

  const now = new Date().toISOString()
  const project: ResearchProject = {
    id: newId('research'),
    name,
    question: null,
    status: 'active',
    report: null,
    created_at: now,
    updated_at: now,
    paper_count: 0,
  }
  writeProjects([project, ...readProjects()])
  return project
}

export async function listResearchProjects(): Promise<ResearchProject[]> {
  if (hasTauriInvoke()) {
    return invokeTauri<ResearchProject[]>('list_research_projects')
  }

  return readProjects().sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
}

export async function getResearchProject(id: string): Promise<ResearchProject> {
  if (hasTauriInvoke()) {
    return invokeTauri<ResearchProject>('get_research_project', { id })
  }

  const project = readProjects().find((p) => p.id === id)
  if (!project) throw new Error('研究项目不存在')
  return project
}

export async function updateResearchProject(
  id: string,
  question?: string,
  report?: string,
): Promise<void> {
  if (hasTauriInvoke()) {
    return invokeTauri<void>('update_research_project', { id, question, report })
  }

  const now = new Date().toISOString()
  writeProjects(readProjects().map((p) => (
    p.id === id
      ? {
          ...p,
          question: question ?? p.question,
          report: report ?? p.report,
          updated_at: now,
        }
      : p
  )))
}

export async function deleteResearchProject(id: string): Promise<void> {
  if (hasTauriInvoke()) {
    return invokeTauri<void>('delete_research_project', { id })
  }

  writeProjects(readProjects().filter((p) => p.id !== id))
  writeNotes(readNotes().filter((n) => n.project_id !== id))
  const paperIds = readResearchPaperIds()
  delete paperIds[id]
  writeResearchPaperIds(paperIds)
}

export async function addPaperToResearch(projectId: string, paperId: string): Promise<void> {
  if (hasTauriInvoke()) {
    return invokeTauri<void>('add_paper_to_research', { projectId, paperId })
  }

  const paperIds = readResearchPaperIds()
  paperIds[projectId] = Array.from(new Set([...(paperIds[projectId] ?? []), paperId]))
  writeResearchPaperIds(paperIds)
  touchProject(projectId)
}

export async function removePaperFromResearch(projectId: string, paperId: string): Promise<void> {
  if (hasTauriInvoke()) {
    return invokeTauri<void>('remove_paper_from_research', { projectId, paperId })
  }

  const paperIds = readResearchPaperIds()
  paperIds[projectId] = (paperIds[projectId] ?? []).filter((id) => id !== paperId)
  writeResearchPaperIds(paperIds)
  touchProject(projectId)
}

export async function listResearchPapers(projectId: string): Promise<ResearchPaper[]> {
  if (hasTauriInvoke()) {
    return invokeTauri<ResearchPaper[]>('list_research_papers', { projectId })
  }

  return (readResearchPaperIds()[projectId] ?? []).map((paperId) => ({
    paper_id: paperId,
    title: paperId,
    authors: null,
    file_path: '',
  }))
}

export async function saveResearchReport(projectId: string, report: string): Promise<void> {
  if (hasTauriInvoke()) {
    return invokeTauri<void>('save_research_report', { projectId, report })
  }

  await updateResearchProject(projectId, undefined, report)
}

export async function addResearchNote(projectId: string, role: string, content: string): Promise<ResearchNote> {
  if (hasTauriInvoke()) {
    return invokeTauri<ResearchNote>('add_research_note', { projectId, role, content })
  }

  const note: ResearchNote = {
    id: newId('note'),
    project_id: projectId,
    role,
    content,
    created_at: new Date().toISOString(),
  }
  writeNotes([...readNotes(), note])
  touchProject(projectId)
  return note
}

export async function listResearchNotes(projectId: string): Promise<ResearchNote[]> {
  if (hasTauriInvoke()) {
    return invokeTauri<ResearchNote[]>('list_research_notes', { projectId })
  }

  return readNotes()
    .filter((n) => n.project_id === projectId)
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
}
