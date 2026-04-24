/**
 * [INPUT]: 依赖 services/ai, lucide-react
 * [OUTPUT]: 对外提供 TranslatePopover 组件
 * [POS]: reader 模块的划词翻译浮层，被 PdfViewer 消费
 */
import { useState, useEffect, useRef } from 'react'
import { chatWithAI } from '../../services/ai'
import { Loader2, X } from 'lucide-react'

interface TranslatePopoverProps {
  text: string
  x: number
  y: number
  onClose: () => void
}

export function TranslatePopover({ text, x, y, onClose }: TranslatePopoverProps) {
  const [translation, setTranslation] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const result = await chatWithAI([
          {
            role: 'system',
            content: '你是一个学术翻译助手。将用户提供的英文学术文本翻译为简体中文。只输出翻译结果，不要解释。保持学术术语的准确性。如果文本很短（单词或短语），给出简明翻译。',
          },
          { role: 'user', content: text },
        ])
        if (!cancelled) setTranslation(result)
      } catch (e) {
        if (!cancelled) setError(String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [text])

  useEffect(() => {
    if (popoverRef.current?.parentElement) {
      setContainerWidth(popoverRef.current.parentElement.clientWidth)
    }
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const width = 340

  return (
    <div
      ref={popoverRef}
      data-selection-toolbar
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      className="absolute rounded-[var(--radius-md)] border border-sand"
      style={{
        left: Math.max(8, Math.min(x - width / 2, containerWidth - width - 8)),
        top: y - 8,
        transform: 'translateY(-100%)',
        width,
        background: 'var(--color-paper)',
        boxShadow: 'var(--shadow-3)',
        zIndex: 'var(--z-popover)',
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-sand">
        <span className="t-caption font-medium text-ink">翻译</span>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded-[var(--radius-sm)] text-ink-mute hover:text-ink cursor-pointer"
          style={{ transition: 'color var(--dur-fast) var(--ease-out)' }}
        >
          <X size={12} />
        </button>
      </div>

      <div className="px-3 py-2.5">
        <p className="t-mono text-[11px] mb-2 line-clamp-2 text-ink-mute">{text}</p>

        {loading && (
          <div className="flex items-center gap-2 text-ink-mute py-1">
            <Loader2 size={12} className="animate-spin" />
            <span className="t-body-sm">翻译中...</span>
          </div>
        )}

        {error && (
          <p className="t-body-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>
        )}

        {translation && (
          <p className="t-body text-ink leading-relaxed">{translation}</p>
        )}
      </div>
    </div>
  )
}
