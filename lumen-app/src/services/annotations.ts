/**
 * [INPUT]: 依赖 @tauri-apps/api/core 的 invoke
 * [OUTPUT]: 对外提供 createAnnotation, listAnnotations, deleteAnnotation
 * [POS]: services 层的标注管理，被 PdfViewer 的高亮功能消费
 */
import { invoke } from '@tauri-apps/api/core'

export interface Annotation {
  id: string
  paper_id: string
  type: string
  content: string | null
  quote: string | null
  page: number | null
  position: string | null
  created_at: string | null
}

export interface CreateAnnotationInput {
  paper_id: string
  type: string
  content?: string
  quote?: string
  page?: number
  position?: string
}

export async function createAnnotation(input: CreateAnnotationInput): Promise<Annotation> {
  return invoke('create_annotation', { input })
}

export async function listAnnotations(paperId: string): Promise<Annotation[]> {
  return invoke('list_annotations', { paperId })
}

export async function deleteAnnotation(id: string): Promise<void> {
  return invoke('delete_annotation', { id })
}
