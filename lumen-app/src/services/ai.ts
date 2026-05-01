/**
 * [INPUT]: 依赖 ai-config service
 * [OUTPUT]: 对外提供 chatWithAI, PROVIDERS, ChatMessage, ImageData 类型
 * [POS]: services 层的 AI 对话，支持多提供商 API / 图片 / 中断，被 AI 面板和翻译浮层消费
 */
import { getAiConfig } from './ai-config'
import { hasTauriInvoke } from './tauri'

export interface ImageData {
  base64: string
  mediaType: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: ImageData[]
}

export interface ProviderDef {
  id: string
  name: string
  modelHint: string
  placeholder: string
}

export const PROVIDERS: ProviderDef[] = [
  { id: 'openai', name: 'OpenAI', modelHint: 'gpt-4o-mini', placeholder: 'sk-...' },
  { id: 'deepseek', name: 'DeepSeek', modelHint: 'deepseek-chat', placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Claude', modelHint: 'claude-sonnet-4-20250514', placeholder: 'sk-ant-...' },
  { id: 'custom', name: '自定义', modelHint: '', placeholder: 'API Key' },
]

const OPENAI_COMPAT_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
}

function parseCustomModelField(modelField: string): { endpoint: string | null; model: string } {
  const parts = modelField.split('|').map((s) => s.trim()).filter(Boolean)
  return {
    endpoint: parts.find((p) => p.startsWith('http')) ?? null,
    model: parts.find((p) => !p.startsWith('http')) ?? '',
  }
}

function buildOpenAIMessages(messages: ChatMessage[]) {
  return messages.map((m) => {
    if (m.images?.length) {
      const content: unknown[] = [{ type: 'text', text: m.content }]
      for (const img of m.images) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
        })
      }
      return { role: m.role, content }
    }
    return { role: m.role, content: m.content }
  })
}

async function callOpenAICompat(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages: buildOpenAIMessages(messages) }),
    signal,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`AI 请求失败 (${res.status}): ${body}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

function buildAnthropicMessages(messages: ChatMessage[]) {
  return messages.filter((m) => m.role !== 'system').map((m) => {
    if (m.images?.length) {
      const content: unknown[] = []
      for (const img of m.images) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
        })
      }
      content.push({ type: 'text', text: m.content })
      return { role: m.role, content }
    }
    return { role: m.role, content: m.content }
  })
}

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const systemMsg = messages.find((m) => m.role === 'system')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemMsg?.content,
      messages: buildAnthropicMessages(messages),
    }),
    signal,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Claude 请求失败 (${res.status}): ${body}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

async function callDevAiProxy(
  provider: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  endpoint?: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey, model, endpoint, messages }),
    signal,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`AI 请求失败 (${res.status}): ${body}`)
  }

  const data = await res.json()
  return data.content ?? ''
}

export async function chatWithAI(
  messages: ChatMessage[],
  provider?: string,
  signal?: AbortSignal,
): Promise<string> {
  const config = await getAiConfig(provider)
  if (!config?.api_key) {
    throw new Error('请先在设置中配置 AI API Key')
  }

  const model = config.default_model || PROVIDERS.find((p) => p.id === config.provider)?.modelHint || ''

  if (!hasTauriInvoke()) {
    if (config.provider === 'custom') {
      const { endpoint, model: customModel } = parseCustomModelField(config.default_model || '')
      if (!endpoint) {
        throw new Error('自定义提供商需要在模型字段填写 API 端点 URL（格式：URL 或 URL|模型名）')
      }
      return callDevAiProxy(config.provider, config.api_key, customModel, messages, endpoint, signal)
    }

    return callDevAiProxy(config.provider, config.api_key, model, messages, undefined, signal)
  }

  if (config.provider === 'anthropic') {
    return callAnthropic(config.api_key, model, messages, signal)
  }

  const endpoint = OPENAI_COMPAT_ENDPOINTS[config.provider]
  if (endpoint) {
    return callOpenAICompat(endpoint, config.api_key, model, messages, signal)
  }

  if (config.provider === 'custom') {
    const { endpoint: customEndpoint, model: customModel } = parseCustomModelField(config.default_model || '')
    if (!customEndpoint) {
      throw new Error('自定义提供商需要在模型字段填写 API 端点 URL（格式：URL 或 URL|模型名）')
    }
    return callOpenAICompat(customEndpoint, config.api_key, customModel, messages, signal)
  }

  throw new Error(`不支持的 AI 提供商: ${config.provider}`)
}
