/**
 * [INPUT]: 依赖 lucide-react 图标，react-router-dom，services/collections
 * [OUTPUT]: 对外提供 Sidebar 组件
 * [POS]: layout 模块的左侧导航栏，被 AppShell 消费
 */
import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Library,
  BookOpen,
  Sparkles,
  GitFork,
  ChevronLeft,
  ChevronRight,
  Plus,
  FolderOpen,
  Trash2,
} from 'lucide-react'
import {
  listCollections,
  createCollection,
  deleteCollection,
  type Collection,
} from '../../services/collections'

interface NavItemConfig {
  id: string
  path: string
  icon: React.ReactNode
  label: string
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'library', path: '/', icon: <Library size={16} />, label: '文献库' },
  { id: 'reader', path: '/reader', icon: <BookOpen size={16} />, label: '阅读器' },
  { id: 'research', path: '/research', icon: <Sparkles size={16} />, label: '深度研究' },
  { id: 'graph', path: '/graph', icon: <GitFork size={16} />, label: '引文图谱' },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [showNewInput, setShowNewInput] = useState(false)
  const [newName, setNewName] = useState('')
  const location = useLocation()
  const navigate = useNavigate()

  const refresh = useCallback(async () => {
    const list = await listCollections()
    setCollections(list)
  }, [])

  useEffect(() => {
    let cancelled = false
    listCollections()
      .then((list) => {
        if (!cancelled) setCollections(list)
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [])

  const handleCreate = useCallback(async () => {
    const name = newName.trim()
    if (!name) return
    await createCollection({ name })
    setNewName('')
    setShowNewInput(false)
    await refresh()
  }, [newName, refresh])

  const handleDelete = useCallback(async (id: string) => {
    await deleteCollection(id)
    await refresh()
    if (location.pathname === `/collection/${id}`) navigate('/')
  }, [refresh, location.pathname, navigate])

  const activeCollectionId = location.pathname.startsWith('/collection/')
    ? location.pathname.split('/')[2]
    : null

  return (
    <aside
      className="flex flex-col border-r border-sand shrink-0"
      style={{
        width: collapsed ? 'var(--sidebar-w-mini)' : 'var(--sidebar-w)',
        background: 'var(--color-paper-deep)',
        transition: 'width var(--dur-base) var(--ease-out)',
      }}
    >
      <nav className={`flex flex-col gap-0.5 ${collapsed ? 'p-2' : 'p-3'}`}>
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path)
            }
            collapsed={collapsed}
            onClick={() => navigate(item.path)}
          />
        ))}
      </nav>

      {!collapsed && (
        <div className="mt-3 flex-1 min-h-0 flex flex-col">
          <div className="px-[18px] py-1.5 flex items-center justify-between">
            <span className="t-caps">Collections</span>
            <button
              onClick={() => setShowNewInput(true)}
              className="w-5 h-5 flex items-center justify-center rounded-[var(--radius-sm)] text-ink-mute hover:text-ink cursor-pointer"
              style={{ transition: 'color var(--dur-fast) var(--ease-out)' }}
              title="新建集合"
            >
              <Plus size={12} />
            </button>
          </div>

          <div className="px-2.5 flex flex-col gap-px overflow-auto">
            {showNewInput && (
              <div className="px-1 py-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate()
                    if (e.key === 'Escape') { setShowNewInput(false); setNewName('') }
                  }}
                  onBlur={() => { if (!newName.trim()) setShowNewInput(false) }}
                  placeholder="集合名称..."
                  className="w-full px-2 py-1 rounded-[var(--radius-sm)] border border-sand text-xs outline-none focus:border-ember"
                  style={{
                    background: 'var(--color-vellum)',
                    transition: 'border-color var(--dur-fast) var(--ease-out)',
                  }}
                />
              </div>
            )}

            {collections.length === 0 && !showNewInput && (
              <span className="text-xs px-2.5 py-1.5 text-ink-mute">暂无集合</span>
            )}

            {collections.map((c) => (
              <CollectionItem
                key={c.id}
                collection={c}
                active={activeCollectionId === c.id}
                onClick={() => navigate(`/collection/${c.id}`)}
                onDelete={() => handleDelete(c.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex-1" />

      <div
        className={`border-t border-sand flex items-center gap-2.5 ${collapsed ? 'p-2 justify-center' : 'p-3'}`}
      >
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-ink">本地文献库</div>
            <div className="t-mono text-[11px]">~/Lumen</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-ink-mute hover:text-ink hover:bg-sand/50 cursor-pointer"
          style={{ transition: 'all var(--dur-fast) var(--ease-out)' }}
          title={collapsed ? '展开侧栏' : '收起侧栏'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  )
}

function NavItem({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItemConfig
  active: boolean
  collapsed: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full border-none rounded-[var(--radius-sm)] cursor-pointer text-left
        ${collapsed ? 'p-2 justify-center' : 'px-2.5 py-2'}
        ${active ? 'bg-sand text-ink font-medium' : 'text-ink-soft hover:bg-sand/50'}
      `}
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--t-body-sm)',
        background: active ? 'var(--color-sand)' : undefined,
        transition: 'all var(--dur-fast) var(--ease-out)',
      }}
    >
      {item.icon}
      {!collapsed && <span>{item.label}</span>}
    </button>
  )
}

function CollectionItem({
  collection,
  active,
  onClick,
  onDelete,
}: {
  collection: Collection
  active: boolean
  onClick: () => void
  onDelete: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-2 w-full px-2.5 py-1.5 rounded-[var(--radius-sm)] text-left cursor-pointer border-none
        ${active ? 'bg-sand text-ink font-medium' : 'text-ink-soft hover:bg-sand/50'}
      `}
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--t-body-sm)',
        transition: 'all var(--dur-fast) var(--ease-out)',
      }}
    >
      <FolderOpen size={13} className="shrink-0" style={{ color: collection.color || undefined }} />
      <span className="truncate flex-1">{collection.name}</span>
      <span className="t-caption text-[11px] shrink-0">{collection.paper_count}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="w-4 h-4 items-center justify-center rounded-[var(--radius-sm)] text-ink-mute hover:text-danger cursor-pointer hidden group-hover:flex shrink-0"
        style={{ transition: 'color var(--dur-fast) var(--ease-out)' }}
        title="删除集合"
      >
        <Trash2 size={11} />
      </button>
    </button>
  )
}
