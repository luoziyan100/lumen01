/**
 * [INPUT]: 依赖 services/collections, services/papers, react-router-dom, lucide-react
 * [OUTPUT]: 对外提供 CollectionPage 页面组件
 * [POS]: pages 模块的集合详情页，挂载在 /collection/:id 路由
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { listCollections, listCollectionPapers, removePaperFromCollection, addPaperToCollection, type Collection } from '../services/collections'
import { getPaper, addPaper, type Paper } from '../services/papers'
import { importPdf } from '../services/files'
import { open } from '@tauri-apps/plugin-dialog'
import { BookOpen, Trash2, FileUp } from 'lucide-react'

export function CollectionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [collection, setCollection] = useState<Collection | null>(null)
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!id) return
    try {
      const colls = await listCollections()
      const coll = colls.find((c) => c.id === id)
      setCollection(coll || null)

      const paperIds = await listCollectionPapers(id)
      const paperList = await Promise.all(
        paperIds.map((pid) => getPaper(pid).catch(() => null))
      )
      setPapers(paperList.filter((p): p is Paper => p !== null))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { refresh() }, [refresh])

  const handleImport = useCallback(async () => {
    if (!id) return
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })
      if (!selected) return

      const paths = Array.isArray(selected) ? selected : [selected]
      for (const filePath of paths) {
        const storedPath = await importPdf(filePath)
        const fileName = filePath.split('/').pop() || filePath
        const paper = await addPaper({
          title: fileName.replace(/\.pdf$/i, ''),
          file_path: storedPath,
        })
        await addPaperToCollection(id, paper.id)
      }
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }, [id, refresh])

  const handleRemove = useCallback(async (paperId: string) => {
    if (!id) return
    await removePaperFromCollection(id, paperId)
    await refresh()
  }, [id, refresh])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="t-body text-ink-mute">加载中...</span>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="t-body text-ink-mute">集合不存在</p>
        <button onClick={() => navigate('/')} className="t-body text-indigo cursor-pointer">
          返回文献库
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>{collection.name}</h1>
          {collection.description && (
            <p className="t-body-sm mt-1">{collection.description}</p>
          )}
          <p className="t-caption mt-2">{papers.length} 篇论文</p>
        </div>
        <button
          onClick={handleImport}
          className="flex items-center gap-2 rounded-[var(--radius-sm)] px-4 py-2 text-white font-medium cursor-pointer"
          style={{
            background: 'var(--color-ember)',
            fontSize: 'var(--t-body)',
            transition: 'opacity var(--dur-fast) var(--ease-out)',
          }}
        >
          <FileUp size={14} />
          导入到此集合
        </button>
      </div>

      {error && (
        <div
          className="mb-4 p-3 rounded-[var(--radius-sm)] t-body-sm"
          style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
        >
          {error}
        </div>
      )}

      {papers.length === 0 ? (
        <div
          className="rounded-[var(--radius-md)] border-2 border-dashed border-sand p-12 flex flex-col items-center gap-3"
        >
          <p className="t-body text-ink-mute">这个集合还没有论文</p>
          <p className="t-body-sm">在文献库中把论文添加到此集合</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {papers.map((paper) => (
            <div
              key={paper.id}
              className="rounded-[var(--radius-md)] border border-sand p-4 flex items-center gap-4 group hover:border-ink-mute cursor-pointer"
              style={{
                background: 'var(--color-vellum)',
                transition: 'border-color var(--dur-fast) var(--ease-out)',
              }}
              onClick={() => navigate(`/reader/${paper.id}`)}
            >
              <div className="flex-1 min-w-0">
                <h3 className="truncate">{paper.title}</h3>
                {paper.authors && (
                  <p className="t-body-sm mt-0.5 truncate">{paper.authors}</p>
                )}
              </div>

              <div
                className="flex items-center gap-1 opacity-0 group-hover:opacity-100"
                style={{ transition: 'opacity var(--dur-fast) var(--ease-out)' }}
              >
                <IconBtn
                  icon={<BookOpen size={14} />}
                  title="打开阅读"
                  onClick={() => navigate(`/reader/${paper.id}`)}
                />
                <IconBtn
                  icon={<Trash2 size={14} />}
                  title="从集合移除"
                  onClick={() => handleRemove(paper.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function IconBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-ink-mute hover:text-ink hover:bg-sand/50 cursor-pointer"
      style={{ transition: 'all var(--dur-fast) var(--ease-out)' }}
    >
      {icon}
    </button>
  )
}
