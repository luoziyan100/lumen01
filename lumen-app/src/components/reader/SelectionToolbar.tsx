/**
 * [INPUT]: 依赖 lucide-react
 * [OUTPUT]: 对外提供 SelectionToolbar 组件
 * [POS]: reader 模块的选中文本操作栏，被 PdfViewer 消费
 */
import { Highlighter, Languages, Trash2, BookMarked } from 'lucide-react'

interface SelectionToolbarProps {
  x: number
  y: number
  mode: 'new' | 'existing'
  onTranslate: () => void
  onHighlight: () => void
  onTerm?: () => void
  onDelete?: () => void
  onClose: () => void
}

export function SelectionToolbar({ x, y, mode, onTranslate, onHighlight, onTerm, onDelete, onClose }: SelectionToolbarProps) {
  const width = mode === 'existing' ? 48 : 120

  return (
    <div
      data-selection-toolbar
      className="absolute flex items-center rounded-[var(--radius-md)] border border-sand"
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
      onMouseUp={(e) => e.stopPropagation()}
      style={{
        left: x - width / 2,
        top: y - 8,
        transform: 'translateY(-100%)',
        background: 'var(--color-paper)',
        boxShadow: 'var(--shadow-3)',
        zIndex: 50,
      }}
    >
      {mode === 'new' ? (
        <>
          <BarBtn icon={<Languages size={14} />} label="翻译" onClick={onTranslate} />
          <div className="w-px h-5 bg-sand" />
          <BarBtn icon={<Highlighter size={14} />} label="高亮" onClick={onHighlight} />
          <div className="w-px h-5 bg-sand" />
          <BarBtn icon={<BookMarked size={14} />} label="术语" onClick={onTerm ?? onClose} />
        </>
      ) : (
        <BarBtn icon={<Trash2 size={14} />} label="删除" onClick={onDelete ?? onClose} danger />
      )}
    </div>
  )
}

function BarBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1 px-2.5 py-1.5 t-caption cursor-pointer ${
        danger ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]' : 'text-ink-mute hover:text-ink hover:bg-sand/50'
      }`}
      style={{ transition: 'all var(--dur-fast) var(--ease-out)' }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
