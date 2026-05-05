/**
 * [INPUT]: 依赖 services/papers, services/files, services/collections, @tauri-apps/plugin-dialog
 * [OUTPUT]: 对外提供 LibraryPage 页面组件
 * [POS]: pages 模块的文献库页面，挂载在 / 路由
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { addPaper, listPapers, deletePaper, type Paper } from '../services/papers'
import { importPdf } from '../services/files'
import { listCollections, addPaperToCollection, type Collection } from '../services/collections'
import { open } from '@tauri-apps/plugin-dialog'
import { FileUp, Trash2, BookOpen, FolderPlus } from 'lucide-react'

export function LibraryPage() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const refresh = useCallback(async () => {
    try {
      const [list, colls] = await Promise.all([listPapers(), listCollections()])
      setPapers(list)
      setCollections(colls)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([listPapers(), listCollections()])
      .then(([list, colls]) => {
        if (cancelled) return
        setPapers(list)
        setCollections(colls)
        setError(null)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleImportClick = useCallback(async () => {
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
        await addPaper({
          title: fileName.replace(/\.pdf$/i, ''),
          file_path: storedPath,
        })
      }
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }, [refresh])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deletePaper(id)
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }, [refresh])

  const handleAddToCollection = useCallback(async (paperId: string, collectionId: string) => {
    try {
      await addPaperToCollection(collectionId, paperId)
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }, [refresh])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="t-body text-ink-mute">加载中...</span>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>文献库</h1>
          <p className="t-body-sm mt-1">
            {papers.length > 0
              ? `共 ${papers.length} 篇论文`
              : '点击导入按钮添加论文'}
          </p>
        </div>
        <button
          onClick={handleImportClick}
          className="flex items-center gap-2 rounded-[var(--radius-sm)] px-4 py-2 text-white font-medium cursor-pointer"
          style={{
            background: 'var(--color-ember)',
            fontSize: 'var(--t-body)',
            transition: 'opacity var(--dur-fast) var(--ease-out)',
          }}
        >
          <FileUp size={14} />
          导入
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
          className="mt-4 rounded-[var(--radius-md)] border-2 border-dashed border-sand p-16 flex flex-col items-center gap-3 cursor-pointer hover:border-ink-faint"
          style={{ transition: 'border-color var(--dur-base) var(--ease-out)' }}
          onClick={handleImportClick}
        >
          <FileUp size={32} className="text-ink-mute" />
          <p className="t-body text-ink-mute">你的文献库还是空的</p>
          <p className="t-body-sm">点击选择 PDF 文件导入</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {papers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              collections={collections}
              onOpen={() => navigate(`/reader/${paper.id}`)}
              onDelete={() => handleDelete(paper.id)}
              onAddToCollection={(collId) => handleAddToCollection(paper.id, collId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PaperCard({
  paper,
  collections,
  onOpen,
  onDelete,
  onAddToCollection,
}: {
  paper: Paper
  collections: Collection[]
  onOpen: () => void
  onDelete: () => void
  onAddToCollection: (collectionId: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const fileName = paper.file_path.split('/').pop() || paper.file_path

  useEffect(() => {
    if (!showMenu) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMenu])

  return (
    <div
      onClick={onOpen}
      className="rounded-[var(--radius-md)] border border-sand p-4 flex items-start gap-4 group hover:border-ink-mute cursor-pointer"
      style={{
        background: 'var(--color-vellum)',
        transition: 'border-color var(--dur-fast) var(--ease-out)',
      }}
    >
      <div className="flex-1 min-w-0">
        <h3 className="truncate">{paper.title}</h3>
        {paper.authors && (
          <p className="t-body-sm mt-0.5 truncate">{paper.authors}</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          {paper.year && <span className="t-caption">{paper.year}</span>}
          <span className="t-mono text-[11px]">{fileName}</span>
          {paper.added_at && (
            <span className="t-caption">
              {new Date(paper.added_at + 'Z').toLocaleDateString('zh-CN')}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 relative"
        style={{ transition: 'opacity var(--dur-fast) var(--ease-out)' }}
      >
        <IconBtn icon={<BookOpen size={14} />} title="打开阅读" onClick={onOpen} />
        {collections.length > 0 && (
          <div className="relative" ref={menuRef}>
            <IconBtn
              icon={<FolderPlus size={14} />}
              title="添加到集合"
              onClick={() => setShowMenu(!showMenu)}
            />
            {showMenu && (
              <div
                className="absolute right-0 top-8 rounded-[var(--radius-md)] border border-sand py-1 min-w-[140px]"
                style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-2)', zIndex: 'var(--z-popover)' }}
              >
                {collections.map((c) => (
                  <button
                    key={c.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddToCollection(c.id)
                      setShowMenu(false)
                    }}
                    className="w-full px-3 py-1.5 text-left t-body-sm text-ink-soft hover:bg-sand/50 cursor-pointer border-none"
                    style={{ fontFamily: 'var(--font-sans)', transition: 'background var(--dur-fast) var(--ease-out)' }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <IconBtn icon={<Trash2 size={14} />} title="删除" onClick={onDelete} />
      </div>
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
