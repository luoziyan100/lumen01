/**
 * [INPUT]: 依赖 services/ai, services/papers, services/files, services/research, lucide-react
 * [OUTPUT]: 对外提供 ResearchPage 页面组件
 * [POS]: pages 模块的深度研究页面，LUI 聊天界面，挂载在 /research 路由
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { chatWithAI, type ChatMessage, type ImageData } from '../services/ai'
import { listPapers, type Paper } from '../services/papers'
import { loadPdfData } from '../services/files'
import { getAiConfig, type AiConfig } from '../services/ai-config'
import { PROVIDERS } from '../services/ai'
import {
  createResearchProject,
  listResearchProjects,
  deleteResearchProject,
  addResearchNote,
  listResearchNotes,
  type ResearchProject,
} from '../services/research'
import { Send, Loader2, Download, Square, Plus, MessageSquare, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: ImageData[]
}

export function ResearchPage() {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [papers, setPapers] = useState<Paper[]>([])
  const [modelLabel, setModelLabel] = useState('')
  const [pendingImages, setPendingImages] = useState<ImageData[]>([])
  const [projects, setProjects] = useState<ResearchProject[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    listPapers().then(setPapers).catch(console.error)
    listResearchProjects().then(setProjects).catch(console.error)
    getAiConfig().then((config: AiConfig | null) => {
      if (!config) { setModelLabel('未配置'); return }
      const prov = PROVIDERS.find((p) => p.id === config.provider)
      const modelId = config.default_model || prov?.modelHint || config.provider
      setModelLabel(`${prov?.name || config.provider} · ${modelId}`)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const loadProject = useCallback(async (projectId: string) => {
    try {
      const notes = await listResearchNotes(projectId)
      const loaded: DisplayMessage[] = notes.map((n) => ({
        id: n.id,
        role: (n.role || 'user') as 'user' | 'assistant',
        content: n.content,
      }))
      setMessages(loaded)
      setActiveProjectId(projectId)
      setError(null)
      setShowHistory(false)
    } catch (e) {
      setError(String(e))
    }
  }, [])

  const startNewChat = useCallback(() => {
    setMessages([])
    setActiveProjectId(null)
    setError(null)
    setShowHistory(false)
    setPendingImages([])
    setInput('')
  }, [])

  const handleDeleteProject = useCallback(async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteResearchProject(projectId)
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
      if (activeProjectId === projectId) startNewChat()
    } catch (err) {
      setError(String(err))
    }
  }, [activeProjectId, startNewChat])

  const buildSystemPrompt = useCallback((): string => {
    const paperList = papers.length > 0
      ? papers.map((p, i) => `${i + 1}. 《${p.title}》${p.authors ? ` — ${p.authors}` : ''}${p.year ? ` (${p.year})` : ''}`).join('\n')
      : '（文献库为空）'

    return `你是 Lumen 深度研究助手。你的角色是帮助用户基于他们的论文库进行跨论文的深度研究。

用户的文献库中有以下论文：
${paperList}

你的工作方式：
1. 用户会告诉你他们想研究什么问题
2. 你分析哪些论文与研究问题相关，告知用户你将要阅读哪些论文
3. 你综合多篇论文的观点，进行对比分析
4. 你产出结构化的研究分析，包含各论文的立场、共识与分歧、结论

使用简体中文回复。引用论文时使用《》标注。回复使用 Markdown 格式。
当用户提出研究问题时，如果需要阅读论文内容，请说"让我来阅读相关论文..."，用户系统会自动提供论文内容。`
  }, [papers])

  const extractPaperContent = useCallback(async (userText: string): Promise<string> => {
    const relevantPapers = papers.filter((p) => {
      const title = p.title.toLowerCase()
      const text = userText.toLowerCase()
      const keywords = text.split(/[\s,，。、]+/).filter((w) => w.length > 2)
      return keywords.some((kw) => title.includes(kw)) || text.includes(p.title)
    })

    const papersToRead = relevantPapers.length > 0 ? relevantPapers : papers.slice(0, 5)
    if (papersToRead.length === 0) return ''

    const contents: string[] = []
    for (const p of papersToRead) {
      try {
        const bytes = await loadPdfData(p.file_path)
        const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const pdfjsLib = await import('pdfjs-dist')
        const doc = await pdfjsLib.getDocument(url).promise
        let text = ''
        const maxPages = Math.min(doc.numPages, 15)
        for (let i = 1; i <= maxPages; i++) {
          const page = await doc.getPage(i)
          const content = await page.getTextContent()
          text += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n'
        }
        URL.revokeObjectURL(url)
        contents.push(`【《${p.title}》全文摘要】\n${text.slice(0, 6000)}`)
      } catch {
        contents.push(`【《${p.title}》】（文本提取失败）`)
      }
    }

    return '\n\n--- 以下是论文内容 ---\n\n' + contents.join('\n\n---\n\n')
  }, [papers])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const images = pendingImages.length > 0 ? [...pendingImages] : undefined
    const userMsg: DisplayMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      images,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setPendingImages([])
    setError(null)
    setLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    let projectId = activeProjectId

    try {
      if (!projectId) {
        const name = text.length > 30 ? text.slice(0, 30) + '...' : text
        const project = await createResearchProject(name)
        projectId = project.id
        setActiveProjectId(projectId)
        setProjects((prev) => [project, ...prev])
      }

      await addResearchNote(projectId, 'user', text)

      const isFirstOrResearchQuery = messages.length === 0 ||
        /研究|分析|对比|总结|综合|读.*论文|看看.*论文/.test(text)

      let paperContext = ''
      if (isFirstOrResearchQuery && papers.length > 0) {
        paperContext = await extractPaperContent(text)
      }

      const history: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt() },
        ...messages.map((m) => ({ role: m.role, content: m.content, images: m.images }) as ChatMessage),
        {
          role: 'user' as const,
          content: paperContext ? text + paperContext : text,
          images,
        },
      ]

      const reply = await chatWithAI(history, undefined, controller.signal)

      await addResearchNote(projectId, 'assistant', reply)

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: reply },
      ])
    } catch (e) {
      if (controller.signal.aborted) return
      setError(String(e))
    } finally {
      abortRef.current = null
      setLoading(false)
    }
  }, [input, loading, messages, papers, pendingImages, activeProjectId, buildSystemPrompt, extractPaperContent])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue
      e.preventDefault()
      const file = item.getAsFile()
      if (!file) continue
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const [header, base64] = dataUrl.split(',')
        const mediaType = header.match(/data:(.*?);/)?.[1] || 'image/png'
        setPendingImages((prev) => [...prev, { base64, mediaType }])
      }
      reader.readAsDataURL(file)
      break
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleExport = useCallback(() => {
    const assistantMsgs = messages.filter((m) => m.role === 'assistant')
    if (assistantMsgs.length === 0) return
    const content = assistantMsgs.map((m) => m.content).join('\n\n---\n\n')
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '研究报告.md'
    a.click()
    URL.revokeObjectURL(url)
  }, [messages])

  const activeProject = projects.find((p) => p.id === activeProjectId)

  return (
    <div
      className="flex-1 flex h-full"
      style={{ background: 'var(--color-paper)' }}
    >
      {/* 历史侧栏 */}
      {showHistory && (
        <div
          className="flex flex-col border-r border-sand shrink-0 h-full"
          style={{ width: 260, background: 'var(--color-vellum)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-sand">
            <span className="t-body-sm font-medium text-ink">研究历史</span>
            <button
              onClick={startNewChat}
              className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] text-ink-mute hover:text-ink hover:bg-sand/50 cursor-pointer"
              style={{ transition: 'all var(--dur-fast) var(--ease-out)' }}
              title="新对话"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-auto py-1">
            {projects.length === 0 && (
              <p className="t-caption text-center py-8">暂无研究记录</p>
            )}
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => loadProject(p.id)}
                className={`group flex items-center gap-2 px-4 py-2.5 cursor-pointer ${
                  p.id === activeProjectId ? 'bg-sand/60' : 'hover:bg-sand/30'
                }`}
                style={{ transition: 'background var(--dur-fast) var(--ease-out)' }}
              >
                <MessageSquare size={13} className="text-ink-mute shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="t-body-sm text-ink truncate">{p.name}</p>
                  {p.updated_at && (
                    <p className="t-caption text-[11px]">
                      {new Date(p.updated_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => handleDeleteProject(p.id, e)}
                  className="w-5 h-5 flex items-center justify-center rounded-[var(--radius-sm)] text-ink-faint opacity-0 group-hover:opacity-100 hover:text-danger cursor-pointer"
                  style={{ transition: 'all var(--dur-fast) var(--ease-out)' }}
                  title="删除"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 主聊天区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-sand shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-ink-mute hover:text-ink hover:bg-sand/50 cursor-pointer"
              style={{ transition: 'all var(--dur-fast) var(--ease-out)' }}
              title={showHistory ? '收起历史' : '研究历史'}
            >
              {showHistory ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
            <span className="t-body font-medium text-ink">
              {activeProject ? activeProject.name : '深度研究'}
            </span>
            {modelLabel && <span className="t-caption text-[11px]">{modelLabel}</span>}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={startNewChat}
              className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] t-caption text-ink-mute hover:text-ink hover:bg-sand/50 cursor-pointer"
              style={{ transition: 'all var(--dur-fast) var(--ease-out)' }}
              title="新对话"
            >
              <Plus size={12} />
              <span>新对话</span>
            </button>
            {messages.some((m) => m.role === 'assistant') && (
              <button
                onClick={handleExport}
                className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] t-caption text-ink-mute hover:text-ink hover:bg-sand/50 cursor-pointer"
                style={{ transition: 'all var(--dur-fast) var(--ease-out)' }}
              >
                <Download size={12} />
                <span>导出</span>
              </button>
            )}
          </div>
        </div>

        {/* 消息区域 */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="max-w-3xl mx-auto">
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-24">
                <p className="t-body text-ink">告诉我你想研究什么</p>
                <p className="t-body-sm text-ink-mute max-w-md">
                  我会从你的文献库中找到相关论文，阅读它们，然后为你做跨论文的综合分析。
                </p>
                {papers.length > 0 && (
                  <p className="t-caption mt-2">文献库中有 {papers.length} 篇论文可供研究</p>
                )}
                {projects.length > 0 && (
                  <button
                    onClick={() => setShowHistory(true)}
                    className="t-caption mt-1 text-indigo cursor-pointer hover:underline"
                  >
                    查看 {projects.length} 条研究历史
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-col gap-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-[var(--radius-md)] t-body-sm whitespace-pre-wrap leading-relaxed ${
                      msg.role === 'user' ? 'text-ink' : 'text-ink'
                    }`}
                    style={{
                      background: msg.role === 'user' ? 'var(--color-indigo)' : 'var(--color-vellum)',
                    }}
                  >
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex gap-1.5 mb-2 flex-wrap">
                        {msg.images.map((img, i) => (
                          <img
                            key={i}
                            src={`data:${img.mediaType};base64,${img.base64}`}
                            className="max-h-40 rounded-[var(--radius-sm)] object-cover"
                          />
                        ))}
                      </div>
                    )}
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-ink-mute py-2">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="t-body-sm">正在阅读论文并分析...</span>
                </div>
              )}
            </div>

            <div ref={bottomRef} />
          </div>
        </div>

        {/* 错误 */}
        {error && (
          <div
            className="mx-6 mb-2 p-2.5 rounded-[var(--radius-sm)] t-caption max-w-3xl mx-auto"
            style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
          >
            {error}
          </div>
        )}

        {/* 输入区 */}
        <div className="px-6 py-4 border-t border-sand shrink-0">
          <div className="max-w-3xl mx-auto">
            {pendingImages.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap">
                {pendingImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={`data:${img.mediaType};base64,${img.base64}`}
                      className="h-20 rounded-[var(--radius-sm)] border border-sand object-cover"
                    />
                    <button
                      onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full text-white text-[10px] opacity-0 group-hover:opacity-100 cursor-pointer"
                      style={{ background: 'var(--color-danger)', transition: 'opacity var(--dur-fast) var(--ease-out)' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div
              className="flex items-end gap-2 rounded-[var(--radius-md)] border border-sand px-4 py-3"
              style={{
                background: 'var(--color-vellum)',
                transition: 'border-color var(--dur-fast) var(--ease-out)',
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="例如：帮我分析这些论文在 AI Agent 架构设计上的共识和分歧（可粘贴图片）"
                rows={2}
                className="flex-1 resize-none border-none outline-none t-body bg-transparent"
                style={{ maxHeight: 160 }}
              />
              {loading ? (
                <button
                  onClick={handleStop}
                  className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] shrink-0 cursor-pointer"
                  style={{
                    background: 'var(--color-danger)',
                    color: 'white',
                    transition: 'opacity var(--dur-fast) var(--ease-out)',
                  }}
                  title="停止生成"
                >
                  <Square size={12} />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() && pendingImages.length === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] shrink-0 cursor-pointer disabled:opacity-30 disabled:cursor-default"
                  style={{
                    background: 'var(--color-ember)',
                    color: 'white',
                    transition: 'opacity var(--dur-fast) var(--ease-out)',
                  }}
                >
                  <Send size={14} />
                </button>
              )}
            </div>
            <p className="t-caption mt-1.5 text-center">Enter 发送，Shift+Enter 换行，可粘贴图片</p>
          </div>
        </div>
      </div>
    </div>
  )
}
