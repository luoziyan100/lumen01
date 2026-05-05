/**
 * [INPUT]: 依赖 CitationGraph, services/papers, services/citations, services/citation-extraction
 * [OUTPUT]: 对外提供 GraphPage 页面组件
 * [POS]: pages 模块的引文图谱页面，挂载在 /graph 路由
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CitationGraph } from '../components/graph/CitationGraph'
import { listPapers, type Paper } from '../services/papers'
import { listCitations, type Citation } from '../services/citations'
import { extractCitationsForPaper } from '../services/citation-extraction'
import { Loader2, RefreshCw, Scan } from 'lucide-react'

export function GraphPage() {
  const navigate = useNavigate()
  const [papers, setPapers] = useState<Paper[]>([])
  const [citations, setCitations] = useState<Citation[]>([])
  const [loading, setLoading] = useState(true)
  const [extracting, setExtracting] = useState(false)
  const [extractProgress, setExtractProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{
    node: { title: string; authors: string | null; year: number | null; citedByCount: number; citesCount: number }
    x: number
    y: number
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const abortRef = useRef<AbortController | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [p, c] = await Promise.all([listPapers(), listCitations()])
      setPapers(p)
      setCitations(c)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([listPapers(), listCitations()])
      .then(([p, c]) => {
        if (cancelled) return
        setPapers(p)
        setCitations(c)
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

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const handleExtract = useCallback(async () => {
    if (papers.length === 0) return
    setExtracting(true)
    setError(null)
    setExtractProgress({ current: 0, total: papers.length })

    const controller = new AbortController()
    abortRef.current = controller

    try {
      for (let i = 0; i < papers.length; i++) {
        if (controller.signal.aborted) break
        setExtractProgress({ current: i + 1, total: papers.length })
        try {
          await extractCitationsForPaper(papers[i], papers, controller.signal)
        } catch (e) {
          if (controller.signal.aborted) break
          console.error(`提取 ${papers[i].title} 引用失败:`, e)
        }
      }
      await loadData()
    } catch (e) {
      if (!controller.signal.aborted) setError(String(e))
    } finally {
      abortRef.current = null
      setExtracting(false)
    }
  }, [papers, loadData])

  const handleStopExtract = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setExtracting(false)
    loadData()
  }, [loadData])

  const handleNodeClick = useCallback(
    (paperId: string) => {
      navigate(`/reader/${paperId}`)
    },
    [navigate],
  )

  const handleNodeHover = useCallback(
    (node: { title: string; authors: string | null; year: number | null; citedByCount: number; citesCount: number } | null, event: MouseEvent) => {
      if (node && event) {
        setTooltip({ node, x: event.clientX, y: event.clientY })
      } else {
        setTooltip(null)
      }
    },
    [],
  )

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-ink-mute" />
      </div>
    )
  }

  const hasConnections = citations.length > 0

  return (
    <div
      className="flex-1 flex flex-col h-full"
      style={{ background: 'var(--color-paper)' }}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-sand shrink-0">
        <div className="flex items-center gap-3">
          <span className="t-body font-medium text-ink">引文图谱</span>
          <span className="t-caption text-[11px]">
            {papers.length} 篇论文 · {citations.length} 条引用关系
          </span>
        </div>
        <div className="flex items-center gap-1">
          {extracting ? (
            <>
              <span className="t-caption text-ink-mute mr-2">
                正在分析 {extractProgress.current}/{extractProgress.total}
              </span>
              <button
                onClick={handleStopExtract}
                className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] t-caption cursor-pointer"
                style={{
                  background: 'var(--color-danger)',
                  color: 'white',
                  transition: 'all var(--dur-fast) var(--ease-out)',
                }}
              >
                停止
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleExtract}
                disabled={papers.length === 0}
                className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] t-caption text-ink-mute hover:text-ink hover:bg-sand/50 cursor-pointer disabled:opacity-30 disabled:cursor-default"
                style={{ transition: 'all var(--dur-fast) var(--ease-out)' }}
              >
                <Scan size={12} />
                <span>提取引用</span>
              </button>
              <button
                onClick={loadData}
                className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] t-caption text-ink-mute hover:text-ink hover:bg-sand/50 cursor-pointer"
                style={{ transition: 'all var(--dur-fast) var(--ease-out)' }}
              >
                <RefreshCw size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 错误 */}
      {error && (
        <div
          className="mx-6 mt-2 p-2.5 rounded-[var(--radius-sm)] t-caption"
          style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
        >
          {error}
        </div>
      )}

      {/* 图谱区域 */}
      <div ref={containerRef} className="flex-1 relative min-h-0">
        {!hasConnections && !extracting ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <p className="t-body text-ink">还没有引用关系数据</p>
            <p className="t-body-sm text-ink-mute max-w-md">
              点击「提取引用」，AI 会分析每篇论文的参考文献，找出库内论文之间的引用关系。
            </p>
            {papers.length > 0 && (
              <button
                onClick={handleExtract}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-md)] t-body-sm cursor-pointer text-white"
                style={{ background: 'var(--color-ember)' }}
              >
                <Scan size={14} />
                开始提取（{papers.length} 篇论文）
              </button>
            )}
            {papers.length === 0 && (
              <p className="t-caption mt-2">文献库为空，请先导入论文</p>
            )}
          </div>
        ) : (
          <CitationGraph
            papers={papers}
            citations={citations}
            width={dimensions.width}
            height={dimensions.height}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
          />
        )}

        {extracting && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]"
            style={{ background: 'var(--color-vellum)', boxShadow: 'var(--shadow-2)' }}
          >
            <Loader2 size={14} className="animate-spin" />
            <span className="t-body-sm text-ink">
              正在分析第 {extractProgress.current} 篇（共 {extractProgress.total} 篇）
            </span>
          </div>
        )}

        {/* 悬浮提示 */}
        {tooltip && (
          <div
            className="fixed z-50 px-3 py-2.5 rounded-[var(--radius-md)] border border-sand max-w-xs pointer-events-none"
            style={{
              background: 'var(--color-paper)',
              boxShadow: 'var(--shadow-2)',
              left: tooltip.x + 12,
              top: tooltip.y + 12,
            }}
          >
            <p className="t-body-sm font-medium text-ink leading-snug">{tooltip.node.title}</p>
            {tooltip.node.authors && (
              <p className="t-caption mt-0.5 truncate">{tooltip.node.authors}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              {tooltip.node.year && <span className="t-caption text-[11px]">{tooltip.node.year}</span>}
              <span className="t-caption text-[11px]">
                被引 {tooltip.node.citedByCount} · 引用 {tooltip.node.citesCount}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
