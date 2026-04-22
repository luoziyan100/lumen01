/**
 * [INPUT]: 依赖 pdfjs-dist 渲染能力，services/annotations，接收 pdfUrl 和 paperId 属性
 * [OUTPUT]: 对外提供 PdfViewer 组件
 * [POS]: reader 模块的核心渲染器，被 ReaderPage 消费
 */
import { useEffect, useRef, useState, useCallback, forwardRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import { TranslatePopover } from './TranslatePopover'
import { SelectionToolbar } from './SelectionToolbar'
import { TermCard } from './TermCard'
import { createAnnotation, listAnnotations, deleteAnnotation, type Annotation } from '../../services/annotations'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

interface PdfViewerProps {
  pdfUrl: string
  paperId?: string
}

const SCALE_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5]
const DEFAULT_SCALE_INDEX = 2

export function PdfViewer({ pdfUrl, paperId }: PdfViewerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [scaleIndex, setScaleIndex] = useState(DEFAULT_SCALE_INDEX)
  const [currentPage, setCurrentPage] = useState(1)
  const [selection, setSelection] = useState<{ text: string; x: number; y: number; pageNum: number } | null>(null)
  const [showTranslate, setShowTranslate] = useState(false)
  const [showTerm, setShowTerm] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [clickedAnnotation, setClickedAnnotation] = useState<{ id: string; x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageEls = useRef<Map<number, HTMLDivElement>>(new Map())

  const scale = SCALE_STEPS[scaleIndex]
  const totalPages = pdf?.numPages ?? 0

  useEffect(() => {
    let cancelled = false
    pdfjsLib.getDocument(pdfUrl).promise.then((doc) => {
      if (!cancelled) setPdf(doc)
    }).catch((err) => {
      console.error('PDF 加载失败:', err)
    })
    return () => { cancelled = true }
  }, [pdfUrl])

  useEffect(() => {
    if (!paperId) return
    listAnnotations(paperId).then(setAnnotations).catch(console.error)
  }, [paperId])

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const scrollTop = container.scrollTop + container.clientHeight / 3

    for (let i = 1; i <= totalPages; i++) {
      const el = pageEls.current.get(i)
      if (el && el.offsetTop + el.clientHeight > scrollTop) {
        setCurrentPage(i)
        break
      }
    }
  }, [totalPages])

  const getPageNumFromNode = useCallback((node: Node): number | null => {
    let el: HTMLElement | null = node instanceof HTMLElement ? node : node.parentElement
    while (el && el !== containerRef.current) {
      const attr = el.getAttribute('data-page-num')
      if (attr) return parseInt(attr, 10)
      el = el.parentElement
    }
    return null
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-selection-toolbar]')) return

    setTimeout(() => {
      const sel = window.getSelection()
      const text = sel?.toString().trim()
      if (!text || text.length < 2) {
        clearTempOverlay(containerRef.current)
        setSelection(null)
        setShowTranslate(false)
        return
      }

      const range = sel?.getRangeAt(0)
      if (!range || !containerRef.current) return

      const pageNum = getPageNumFromNode(range.startContainer)
      const rect = range.getBoundingClientRect()
      const container = containerRef.current
      const containerRect = container.getBoundingClientRect()

      // 用 getClientRects 获取选区的精确像素位置，创建 overlay
      clearTempOverlay(container)
      createTempOverlay(range, container)

      // 清除浏览器选区（overlay 已经提供视觉反馈）
      sel?.removeAllRanges()

      setSelection({
        text,
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 8 + container.scrollTop,
        pageNum: pageNum ?? currentPage,
      })
      setShowTranslate(false)
      setClickedAnnotation(null)
    }, 10)
  }, [currentPage, getPageNumFromNode])

  const handleHighlight = useCallback(async () => {
    if (!selection || !paperId) return

    const ann = await createAnnotation({
      paper_id: paperId,
      type: 'highlight',
      quote: selection.text,
      page: selection.pageNum,
    })
    setAnnotations((prev) => [...prev, ann])
    clearTempOverlay(containerRef.current)
    setSelection(null)
  }, [selection, paperId])

  const handleTranslate = useCallback(() => {
    setShowTranslate(true)
    setShowTerm(false)
  }, [])

  const handleTerm = useCallback(() => {
    setShowTerm(true)
    setShowTranslate(false)
  }, [])

  const handleDeleteAnnotation = useCallback(async () => {
    if (!clickedAnnotation) return
    await deleteAnnotation(clickedAnnotation.id)
    setAnnotations((prev) => prev.filter((a) => a.id !== clickedAnnotation.id))
    setClickedAnnotation(null)
  }, [clickedAnnotation])

  const handleHighlightClick = useCallback((id: string, x: number, y: number) => {
    setClickedAnnotation({ id, x, y })
    setSelection(null)
    setShowTranslate(false)
  }, [])

  const zoomIn = () => setScaleIndex((i) => Math.min(i + 1, SCALE_STEPS.length - 1))
  const zoomOut = () => setScaleIndex((i) => Math.max(i - 1, 0))
  const resetZoom = () => setScaleIndex(DEFAULT_SCALE_INDEX)

  if (!pdf) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-mute">
        <span className="t-body">正在加载文档...</span>
      </div>
    )
  }

  const pageAnnotations = (pageNum: number) =>
    annotations.filter((a) => a.page === pageNum && a.type === 'highlight')

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div
        className="h-9 flex items-center justify-between px-4 border-b border-sand shrink-0"
        style={{ background: 'var(--color-vellum)' }}
      >
        <span className="t-caption">
          {currentPage} / {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <ToolbarBtn icon={<ZoomOut size={14} />} onClick={zoomOut} title="缩小" />
          <button
            onClick={resetZoom}
            className="px-2 h-6 rounded-[var(--radius-sm)] t-caption hover:bg-sand/50 cursor-pointer"
            style={{ transition: 'background var(--dur-fast) var(--ease-out)' }}
          >
            {Math.round(scale * 100)}%
          </button>
          <ToolbarBtn icon={<ZoomIn size={14} />} onClick={zoomIn} title="放大" />
          <ToolbarBtn icon={<RotateCw size={14} />} onClick={resetZoom} title="重置" />
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        onMouseUp={handleMouseUp}
        className="flex-1 overflow-auto relative"
        style={{ background: 'var(--color-sand)' }}
      >
        <div className="flex flex-col items-center gap-2 py-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <PageCanvas
              key={pageNum}
              pdf={pdf}
              pageNum={pageNum}
              scale={scale}
              highlights={pageAnnotations(pageNum)}
              onHighlightClick={handleHighlightClick}
              ref={(el: HTMLDivElement | null) => {
                if (el) pageEls.current.set(pageNum, el)
              }}
            />
          ))}
        </div>

        {selection && !showTranslate && !showTerm && (
          <SelectionToolbar
            x={selection.x}
            y={selection.y}
            mode="new"
            onTranslate={handleTranslate}
            onHighlight={handleHighlight}
            onTerm={handleTerm}
            onClose={() => { clearTempOverlay(containerRef.current); setSelection(null) }}
          />
        )}

        {selection && showTranslate && (
          <TranslatePopover
            text={selection.text}
            x={selection.x}
            y={selection.y}
            onClose={() => { clearTempOverlay(containerRef.current); setSelection(null); setShowTranslate(false) }}
          />
        )}

        {selection && showTerm && (
          <TermCard
            term={selection.text}
            x={selection.x}
            y={selection.y}
            paperId={paperId}
            pageNum={selection.pageNum}
            onClose={() => { clearTempOverlay(containerRef.current); setSelection(null); setShowTerm(false) }}
            onSaved={() => {
              if (paperId) listAnnotations(paperId).then(setAnnotations).catch(console.error)
            }}
          />
        )}

        {clickedAnnotation && (
          <SelectionToolbar
            x={clickedAnnotation.x}
            y={clickedAnnotation.y}
            mode="existing"
            onTranslate={() => {}}
            onHighlight={() => {}}
            onDelete={handleDeleteAnnotation}
            onClose={() => setClickedAnnotation(null)}
          />
        )}
      </div>
    </div>
  )
}

const PageCanvas = forwardRef<HTMLDivElement, {
  pdf: PDFDocumentProxy
  pageNum: number
  scale: number
  highlights: Annotation[]
  onHighlightClick: (id: string, x: number, y: number) => void
}>(({ pdf, pageNum, scale, highlights, onHighlightClick }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)

  useEffect(() => {
    let cancelled = false

    pdf.getPage(pageNum).then(async (page: PDFPageProxy) => {
      if (cancelled) return
      const canvas = canvasRef.current
      const textDiv = textLayerRef.current
      if (!canvas || !textDiv) return

      const dpr = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: scale * dpr })
      const cssViewport = page.getViewport({ scale })

      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${cssViewport.width}px`
      canvas.style.height = `${cssViewport.height}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
      }

      const task = page.render({ canvasContext: ctx, viewport })
      renderTaskRef.current = { cancel: () => task.cancel() }
      task.promise.catch(() => {})

      textDiv.innerHTML = ''
      textDiv.style.setProperty('--scale-factor', String(scale))

      const textContent = await page.getTextContent()
      if (cancelled) return

      const textLayer = new TextLayer({
        textContentSource: textContent,
        container: textDiv,
        viewport: cssViewport,
      })
      await textLayer.render()

      applyHighlights(textDiv, highlights, onHighlightClick)
    })

    return () => {
      cancelled = true
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
        renderTaskRef.current = null
      }
    }
  }, [pdf, pageNum, scale, highlights, onHighlightClick])

  return (
    <div ref={ref} data-page-num={pageNum} className="relative" style={{ width: 'fit-content' }}>
      <canvas
        ref={canvasRef}
        className="shadow-[var(--shadow-2)]"
        style={{ background: 'white', display: 'block' }}
      />
      <div ref={textLayerRef} className="textLayer" />
    </div>
  )
})

PageCanvas.displayName = 'PageCanvas'

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ')
}

function applyHighlights(
  textDiv: HTMLDivElement,
  highlights: Annotation[],
  onHighlightClick: (id: string, x: number, y: number) => void,
) {
  if (!highlights.length) return

  const spans = Array.from(textDiv.querySelectorAll<HTMLSpanElement>('span'))
  if (!spans.length) return

  const spanTexts = spans.map((s) => s.textContent || '')

  // 拼接全文并记录每个 span 在 normalized 文本中的位置
  // 在 span 之间加空格以支持跨行匹配
  let normalizedFull = ''
  const spanRanges: { span: HTMLSpanElement; nStart: number; nEnd: number; raw: string }[] = []

  for (let i = 0; i < spans.length; i++) {
    if (i > 0) normalizedFull += ' '
    const raw = spanTexts[i]
    const norm = normalizeWs(raw)
    const nStart = normalizedFull.length
    normalizedFull += norm
    spanRanges.push({ span: spans[i], nStart, nEnd: normalizedFull.length, raw })
  }

  for (const hl of highlights) {
    if (!hl.quote) continue

    const normQuote = normalizeWs(hl.quote.trim())
    const idx = normalizedFull.indexOf(normQuote)
    if (idx === -1) continue

    const hlEnd = idx + normQuote.length

    for (const { span, nStart, nEnd, raw } of spanRanges) {
      if (nEnd <= idx || nStart >= hlEnd) continue

      const textNode = span.firstChild
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) continue

      const normSpan = normalizeWs(raw)
      const overlapStart = Math.max(0, idx - nStart)
      const overlapEnd = Math.min(normSpan.length, hlEnd - nStart)

      // 将 normalized 偏移映射回原始文本偏移
      const rawStart = mapNormToRaw(raw, overlapStart)
      const rawEnd = mapNormToRaw(raw, overlapEnd)

      if (rawStart === 0 && rawEnd === raw.length) {
        span.classList.add('pdf-highlight')
        span.setAttribute('data-hl-id', hl.id)
        addHighlightClickHandler(span, hl.id, textDiv, onHighlightClick)
      } else {
        const before = raw.substring(0, rawStart)
        const highlighted = raw.substring(rawStart, rawEnd)
        const after = raw.substring(rawEnd)

        span.textContent = ''

        if (before) span.appendChild(document.createTextNode(before))

        const mark = document.createElement('mark')
        mark.textContent = highlighted
        mark.className = 'pdf-highlight'
        mark.setAttribute('data-hl-id', hl.id)
        addHighlightClickHandler(mark, hl.id, textDiv, onHighlightClick)
        span.appendChild(mark)

        if (after) span.appendChild(document.createTextNode(after))
      }
    }
  }
}

function mapNormToRaw(raw: string, normOffset: number): number {
  let ni = 0
  let ri = 0
  while (ni < normOffset && ri < raw.length) {
    if (/\s/.test(raw[ri])) {
      const start = ri
      while (ri < raw.length && /\s/.test(raw[ri])) ri++
      ni++
      if (ni >= normOffset) return start + 1
    } else {
      ri++
      ni++
    }
  }
  return ri
}

function addHighlightClickHandler(
  el: HTMLElement,
  hlId: string,
  textDiv: HTMLDivElement,
  onHighlightClick: (id: string, x: number, y: number) => void,
) {
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    const rect = el.getBoundingClientRect()
    const container = textDiv.closest('.overflow-auto')
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    onHighlightClick(
      hlId,
      rect.left - containerRect.left + rect.width / 2,
      rect.top - containerRect.top - 8 + container.scrollTop,
    )
  })
}

function createTempOverlay(range: Range, container: HTMLElement) {
  const rects = range.getClientRects()
  const containerRect = container.getBoundingClientRect()

  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    if (r.width === 0 || r.height === 0) continue

    const overlay = document.createElement('div')
    overlay.className = 'pdf-temp-overlay'
    overlay.style.position = 'absolute'
    overlay.style.left = `${r.left - containerRect.left + container.scrollLeft}px`
    overlay.style.top = `${r.top - containerRect.top + container.scrollTop}px`
    overlay.style.width = `${r.width}px`
    overlay.style.height = `${r.height}px`
    overlay.style.pointerEvents = 'none'
    container.appendChild(overlay)
  }
}

function clearTempOverlay(container: HTMLElement | null) {
  if (!container) return
  container.querySelectorAll('.pdf-temp-overlay').forEach((el) => el.remove())
}

function ToolbarBtn({ icon, onClick, title }: { icon: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] text-ink-mute hover:text-ink hover:bg-sand/50 cursor-pointer"
      style={{ transition: 'all var(--dur-fast) var(--ease-out)' }}
    >
      {icon}
    </button>
  )
}
