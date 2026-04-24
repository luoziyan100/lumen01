/**
 * [INPUT]: 依赖 services/ai, services/annotations, lucide-react
 * [OUTPUT]: 对外提供 TermCard 组件
 * [POS]: reader 模块的术语卡片浮层，被 PdfViewer 消费
 */
import { useState, useEffect, useRef } from 'react'
import { chatWithAI } from '../../services/ai'
import { createAnnotation } from '../../services/annotations'
import { Loader2, X, Check } from 'lucide-react'

interface TermCardProps {
  term: string
  x: number
  y: number
  paperId?: string
  pageNum: number
  onClose: () => void
  onSaved: () => void
}

interface TermData {
  term: string
  definition: string
  detail: string
}

export function TermCard({ term, x, y, paperId, pageNum, onClose, onSaved }: TermCardProps) {
  const [data, setData] = useState<TermData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [containerWidth, setContainerWidth] = useState(800)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const result = await chatWithAI([
          {
            role: 'system',
            content: `你是一个学术术语解释助手。用户会给你一个学术术语或短语，请用以下 JSON 格式回复（不要输出其他内容）：
{"term":"英文术语原文","definition":"一句话中文定义（20字以内）","detail":"详细解释（50-100字，包含该术语在学术领域的含义、用途和重要性）"}`,
          },
          { role: 'user', content: term },
        ])

        if (cancelled) return

        const parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, '').trim())
        setData(parsed)
      } catch (e) {
        if (!cancelled) setError(String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [term])

  useEffect(() => {
    if (cardRef.current?.parentElement) {
      setContainerWidth(cardRef.current.parentElement.clientWidth)
    }
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const handleSave = async () => {
    if (!paperId || !data || saved) return

    await createAnnotation({
      paper_id: paperId,
      type: 'term',
      quote: term,
      content: JSON.stringify(data),
      page: pageNum,
    })
    setSaved(true)
    onSaved()
  }

  const width = 360

  return (
    <div
      ref={cardRef}
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
        zIndex: 50,
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-sand">
        <span className="t-caption font-medium text-ink">术语卡片</span>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded-[var(--radius-sm)] text-ink-mute hover:text-ink cursor-pointer"
          style={{ transition: 'color var(--dur-fast) var(--ease-out)' }}
        >
          <X size={12} />
        </button>
      </div>

      <div className="px-3 py-2.5">
        {loading && (
          <div className="flex items-center gap-2 text-ink-mute py-3">
            <Loader2 size={12} className="animate-spin" />
            <span className="t-body-sm">解析术语...</span>
          </div>
        )}

        {error && (
          <p className="t-body-sm py-2" style={{ color: 'var(--color-danger)' }}>{error}</p>
        )}

        {data && (
          <div className="flex flex-col gap-2">
            <div>
              <span className="t-mono text-[12px] text-ink font-medium">{data.term}</span>
              <span className="t-body-sm text-ink-mute ml-2">{data.definition}</span>
            </div>
            <p className="t-body-sm text-ink leading-relaxed">{data.detail}</p>
          </div>
        )}
      </div>

      {data && paperId && (
        <div className="px-3 py-2 border-t border-sand flex justify-end">
          <button
            onClick={handleSave}
            disabled={saved}
            className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] t-caption cursor-pointer disabled:cursor-default"
            style={{
              background: saved ? 'var(--color-moss-tint)' : 'var(--color-ember)',
              color: saved ? 'var(--color-moss)' : 'white',
              transition: 'all var(--dur-fast) var(--ease-out)',
            }}
          >
            {saved ? <><Check size={12} /><span>已保存</span></> : <span>保存术语</span>}
          </button>
        </div>
      )}
    </div>
  )
}
