/**
 * [INPUT]: 依赖 @tauri-apps/api/core 的 invoke
 * [OUTPUT]: 对外提供 Collections CRUD 函数
 * [POS]: services 层的集合管理，被 Sidebar 和 LibraryPage 消费
 */
import { invoke } from '@tauri-apps/api/core'

export interface Collection {
  id: string
  name: string
  description: string | null
  color: string | null
  paper_count: number
  created_at: string | null
}

export interface CreateCollectionInput {
  name: string
  description?: string
  color?: string
}

export async function createCollection(input: CreateCollectionInput): Promise<Collection> {
  return invoke('create_collection', { input })
}

export async function listCollections(): Promise<Collection[]> {
  return invoke('list_collections')
}

export async function updateCollection(id: string, input: { name?: string; description?: string; color?: string }): Promise<void> {
  return invoke('update_collection', { id, input })
}

export async function deleteCollection(id: string): Promise<void> {
  return invoke('delete_collection', { id })
}

export async function addPaperToCollection(collectionId: string, paperId: string): Promise<void> {
  return invoke('add_paper_to_collection', { collectionId, paperId })
}

export async function removePaperFromCollection(collectionId: string, paperId: string): Promise<void> {
  return invoke('remove_paper_from_collection', { collectionId, paperId })
}

export async function listCollectionPapers(collectionId: string): Promise<string[]> {
  return invoke('list_collection_papers', { collectionId })
}
