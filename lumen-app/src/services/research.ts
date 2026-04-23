/**
 * [INPUT]: 依赖 @tauri-apps/api/core 的 invoke
 * [OUTPUT]: 对外提供 research 项目 CRUD
 * [POS]: services 层的研究项目管理，被 ResearchPage 消费
 */
import { invoke } from '@tauri-apps/api/core'

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

export async function createResearchProject(name: string): Promise<ResearchProject> {
  return invoke('create_research_project', { name })
}

export async function listResearchProjects(): Promise<ResearchProject[]> {
  return invoke('list_research_projects')
}

export async function getResearchProject(id: string): Promise<ResearchProject> {
  return invoke('get_research_project', { id })
}

export async function updateResearchProject(
  id: string,
  question?: string,
  report?: string,
): Promise<void> {
  return invoke('update_research_project', { id, question, report })
}

export async function deleteResearchProject(id: string): Promise<void> {
  return invoke('delete_research_project', { id })
}

export async function addPaperToResearch(projectId: string, paperId: string): Promise<void> {
  return invoke('add_paper_to_research', { projectId, paperId })
}

export async function removePaperFromResearch(projectId: string, paperId: string): Promise<void> {
  return invoke('remove_paper_from_research', { projectId, paperId })
}

export async function listResearchPapers(projectId: string): Promise<ResearchPaper[]> {
  return invoke('list_research_papers', { projectId })
}

export async function saveResearchReport(projectId: string, report: string): Promise<void> {
  return invoke('save_research_report', { projectId, report })
}
