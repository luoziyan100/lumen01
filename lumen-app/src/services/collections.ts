/**
 * [INPUT]: 依赖 services/tauri
 * [OUTPUT]: 对外提供 Collections CRUD 函数
 * [POS]: services 层的集合管理，被 Sidebar 和 LibraryPage 消费
 */
import { hasTauriInvoke, invokeTauri } from './tauri'

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

const COLLECTIONS_KEY = 'lumen.dev.collections'
const COLLECTION_PAPERS_KEY = 'lumen.dev.collection.paperIds'

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

function newCollectionId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `collection-${random}`
}

function readCollections(): Collection[] {
  const paperIds = readCollectionPaperIds()
  return readLocal<Collection[]>(COLLECTIONS_KEY, []).map((c) => ({
    ...c,
    paper_count: paperIds[c.id]?.length ?? c.paper_count ?? 0,
  }))
}

function writeCollections(collections: Collection[]): void {
  writeLocal(COLLECTIONS_KEY, collections)
}

function readCollectionPaperIds(): Record<string, string[]> {
  return readLocal<Record<string, string[]>>(COLLECTION_PAPERS_KEY, {})
}

function writeCollectionPaperIds(value: Record<string, string[]>): void {
  writeLocal(COLLECTION_PAPERS_KEY, value)
}

export async function createCollection(input: CreateCollectionInput): Promise<Collection> {
  if (hasTauriInvoke()) {
    return invokeTauri<Collection>('create_collection', { input })
  }

  const collection: Collection = {
    id: newCollectionId(),
    name: input.name,
    description: input.description ?? null,
    color: input.color ?? null,
    paper_count: 0,
    created_at: new Date().toISOString(),
  }
  writeCollections([...readCollections(), collection])
  return collection
}

export async function listCollections(): Promise<Collection[]> {
  if (hasTauriInvoke()) {
    return invokeTauri<Collection[]>('list_collections')
  }

  return readCollections()
}

export async function updateCollection(id: string, input: { name?: string; description?: string; color?: string }): Promise<void> {
  if (hasTauriInvoke()) {
    return invokeTauri<void>('update_collection', { id, input })
  }

  writeCollections(readCollections().map((c) => (
    c.id === id
      ? {
          ...c,
          name: input.name ?? c.name,
          description: input.description ?? c.description,
          color: input.color ?? c.color,
        }
      : c
  )))
}

export async function deleteCollection(id: string): Promise<void> {
  if (hasTauriInvoke()) {
    return invokeTauri<void>('delete_collection', { id })
  }

  writeCollections(readCollections().filter((c) => c.id !== id))
  const paperIds = readCollectionPaperIds()
  delete paperIds[id]
  writeCollectionPaperIds(paperIds)
}

export async function addPaperToCollection(collectionId: string, paperId: string): Promise<void> {
  if (hasTauriInvoke()) {
    return invokeTauri<void>('add_paper_to_collection', { collectionId, paperId })
  }

  const paperIds = readCollectionPaperIds()
  paperIds[collectionId] = Array.from(new Set([...(paperIds[collectionId] ?? []), paperId]))
  writeCollectionPaperIds(paperIds)
}

export async function removePaperFromCollection(collectionId: string, paperId: string): Promise<void> {
  if (hasTauriInvoke()) {
    return invokeTauri<void>('remove_paper_from_collection', { collectionId, paperId })
  }

  const paperIds = readCollectionPaperIds()
  paperIds[collectionId] = (paperIds[collectionId] ?? []).filter((id) => id !== paperId)
  writeCollectionPaperIds(paperIds)
}

export async function listCollectionPapers(collectionId: string): Promise<string[]> {
  if (hasTauriInvoke()) {
    return invokeTauri<string[]>('list_collection_papers', { collectionId })
  }

  return readCollectionPaperIds()[collectionId] ?? []
}
