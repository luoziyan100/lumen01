/**
 * [INPUT]: 依赖 services/ai, lucide-react
 * [OUTPUT]: 对外提供 AiPanel 组件
 * [POS]: ai 模块的聊天面板，被 ReaderPage 消费
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { chatWithAI, PROVIDERS, type ChatMessage } from '../../services/ai'
import { getAiConfig } from '../../services/ai-config'
import { Send, X, Loader2 } from 'lucide-react'

interface AiPanelProps {
  paperTitle: string
  initialPrompt?: string | null
  onClose: () => void
}

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function AiPanel({ paperTitle, initialPrompt, onClose }: AiPanelProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modelLabel, setModelLabel] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    getAiConfig().then((config) => {
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

  const sendMessage = useCallback(async (text: string, prevMessages: DisplayMessage[]) => {
    const userMsg: DisplayMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setError(null)
    setLoading(true)

    try {
      const systemPrompt: ChatMessage = {
        role: 'system',
        content: `你是 Lumen 论文研究助手。用户正在阅读论文《${paperTitle}》。请根据用户的问题提供专业、准确的回答。使用简体中文回复。`,
      }

      const history: ChatMessage[] = [
        systemPrompt,
        ...prevMessages.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
        { role: 'user' as const, content: text },
      ]

      const reply = await chatWithAI(history)

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: reply },
      ])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [paperTitle])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    sendMessage(text, messages)
  }, [input, loading, messages, sendMessage])

  const initialSent = useRef(false)
  useEffect(() => {
    if (initialPrompt && !initialSent.current) {
      initialSent.current = true
      sendMessage(initialPrompt, [])
    }
  }, [initialPrompt, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  return (
    <div
      className="flex flex-col border-l border-sand h-full"
      style={{ width: 380, background: 'var(--color-paper)' }}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-sand shrink-0">
        <div className="flex items-center gap-2">
          <span className="t-body-sm font-medium text-ink">AI 助手</span>
          {modelLabel && <span className="t-caption text-[11px]">{modelLabel}</span>}
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] text-ink-mute hover:text-ink hover:bg-sand/50 cursor-pointer"
          style={{ transition: 'all var(--dur-fast) var(--ease-out)' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <p className="t-body text-ink-mute">关于这篇论文，你想了解什么？</p>
            <p className="t-caption">可以提问论文的核心观点、方法、结论等</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-ink-mute py-2">
              <Loader2 size={14} className="animate-spin" />
              <span className="t-body-sm">思考中...</span>
            </div>
          )}
        </div>

        <div ref={bottomRef} />
      </div>

      {/* 错误提示 */}
      {error && (
        <div
          className="mx-4 mb-2 p-2.5 rounded-[var(--radius-sm)] t-caption"
          style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
        >
          {error}
        </div>
      )}

      {/* 输入区 */}
      <div className="px-4 py-3 border-t border-sand shrink-0">
        <div
          className="flex items-end gap-2 rounded-[var(--radius-md)] border border-sand px-3 py-2"
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
            placeholder="输入问题..."
            rows={1}
            className="flex-1 resize-none border-none outline-none t-body bg-transparent"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] shrink-0 cursor-pointer disabled:opacity-30 disabled:cursor-default"
            style={{
              background: 'var(--color-ember)',
              color: 'white',
              transition: 'opacity var(--dur-fast) var(--ease-out)',
            }}
          >
            <Send size={13} />
          </button>
        </div>
        <p className="t-caption mt-1.5 text-center">Enter 发送，Shift+Enter 换行</p>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3 py-2 rounded-[var(--radius-md)] t-body-sm whitespace-pre-wrap ${
          isUser ? 'text-white' : 'text-ink'
        }`}
        style={{
          background: isUser ? 'var(--color-indigo)' : 'var(--color-vellum)',
        }}
      >
        {message.content}
      </div>
    </div>
  )
}
