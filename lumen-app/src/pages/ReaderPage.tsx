/**
 * [INPUT]: 依赖 PdfViewer, AiPanel, services/papers, services/files, react-router-dom
 * [OUTPUT]: 对外提供 ReaderPage 页面组件
 * [POS]: pages 模块的阅读器页面，挂载在 /reader 和 /reader/:id 路由
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PdfViewer } from '../components/reader/PdfViewer'
import { AiPanel } from '../components/ai/AiPanel'
import { getPaper } from '../services/papers'
import { loadPdfData } from '../services/files'
import { FileUp, MessageSquare, BookOpen } from 'lucide-react'

export function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loadingPaper, setLoadingPaper] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const [deepReadPrompt, setDeepReadPrompt] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoadingPaper(true)
    setError(null)

    ;(async () => {
      try {
        const paper = await getPaper(id)
        const bytes = await loadPdfData(paper.file_path)
        if (cancelled) return
        const blob = new Blob([bytes], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        setPdfUrl(url)
        setFileName(paper.title)
      } catch (e) {
        if (!cancelled) setError(String(e))
      } finally {
        if (!cancelled) setLoadingPaper(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  const loadFile = useCallback(async (file: File) => {
    const blob = new Blob([await file.arrayBuffer()], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(url)
    setFileName(file.name)
    setError(null)
  }, [pdfUrl])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
  }, [loadFile])

  const handleClose = useCallback(() => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(null)
    setFileName('')
    setError(null)
    setShowAi(false)
    if (id) navigate('/reader')
  }, [id, navigate, pdfUrl])

  if (loadingPaper) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="t-body text-ink-mute">正在加载文档...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div
          className="p-4 rounded-[var(--radius-md)] max-w-md"
          style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
        >
          <p className="t-body">{error}</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="t-body text-indigo cursor-pointer"
        >
          返回文献库
        </button>
      </div>
    )
  }

  if (pdfUrl) {
    return (
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-2 border-b border-sand flex items-center gap-2">
            <span className="t-body-sm text-ink-soft truncate">{fileName}</span>
            <div className="ml-auto flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  const prompt = `请帮我精读这篇论文《${fileName}》，回答以下5个问题，用中文回答：\n1.【一句话总结】这篇论文在说什么？\n2.【核心框架】论文的主要论点/框架是什么？\n3.【开放问题】论文提出了哪些未解决的问题？\n4.【对我的用处】这篇论文有什么直接可用的东西？\n5.【它的盲区】这篇论文没做到什么？`
                  setDeepReadPrompt(prompt)
                  setShowAi(true)
                }}
                className="h-7 flex items-center gap-1 px-2 rounded-[var(--radius-sm)] cursor-pointer text-ink-mute hover:text-ink hover:bg-sand/50"
                style={{ transition: 'all var(--dur-fast) var(--ease-out)' }}
                title="五问精读"
              >
                <BookOpen size={14} />
                <span className="t-caption">精读</span>
              </button>
              <button
                onClick={() => { setDeepReadPrompt(null); setShowAi(!showAi) }}
                className={`w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] cursor-pointer ${
                  showAi ? 'text-ember bg-ember-tint' : 'text-ink-mute hover:text-ink hover:bg-sand/50'
                }`}
                style={{ transition: 'all var(--dur-fast) var(--ease-out)' }}
                title="AI 助手"
              >
                <MessageSquare size={14} />
              </button>
              <button
                onClick={handleClose}
                className="t-caption text-ink-mute hover:text-ink cursor-pointer"
                style={{ transition: 'color var(--dur-fast) var(--ease-out)' }}
              >
                关闭
              </button>
            </div>
          </div>
          <PdfViewer pdfUrl={pdfUrl} paperId={id} />
        </div>

        {showAi && (
          <AiPanel
            paperTitle={fileName}
            initialPrompt={deepReadPrompt}
            onClose={() => { setShowAi(false); setDeepReadPrompt(null) }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className="w-full max-w-lg rounded-[var(--radius-lg)] border-2 border-dashed border-sand p-16 flex flex-col items-center gap-4 cursor-pointer hover:border-ink-faint"
        style={{ transition: 'all var(--dur-base) var(--ease-out)' }}
        onClick={() => inputRef.current?.click()}
      >
        <FileUp size={32} className="text-ink-mute" />
        <div className="text-center">
          <p className="t-body text-ink">选择一个 PDF 文件</p>
          <p className="t-body-sm mt-1">或从文献库中打开论文</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>
    </div>
  )
}
