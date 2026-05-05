/**
 * [INPUT]: 依赖 ai-config service 和 tauri 环境检测
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

export type AgentModelRole =
  | 'planner'
  | 'reflector'
  | 'synthesizer'
  | 'simple_answer'
  | 'local_paper_analysis'
  | 'risk_sensor'

export interface ChatOptions {
  provider?: string
  model?: string
  endpoint?: string
  temperature?: number
  maxTokens?: number
  responseFormat?: 'json' | 'text'
  signal?: AbortSignal
}

export const PROVIDERS: ProviderDef[] = [
  { id: 'openai', name: 'OpenAI', modelHint: 'gpt-4o-mini', placeholder: 'sk-...' },
  { id: 'openai-codex', name: 'OpenAI GPT OAuth', modelHint: 'gpt-5.5', placeholder: 'OpenClaw profile id（可选）' },
  { id: 'deepseek', name: 'DeepSeek', modelHint: 'deepseek-chat', placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Claude', modelHint: 'claude-sonnet-4-20250514', placeholder: 'sk-ant-...' },
  { id: 'custom', name: '自定义', modelHint: '', placeholder: 'API Key' },
]

const OPENAI_COMPAT_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
}

const DEEPSEEK_ROLE_MODELS: Record<AgentModelRole, string> = {
  planner: 'deepseek-v4-flash',
  reflector: 'deepseek-v4-flash',
  simple_answer: 'deepseek-v4-flash',
  risk_sensor: 'deepseek-v4-flash',
  synthesizer: 'deepseek-v4-pro',
  local_paper_analysis: 'deepseek-v4-pro',
}

const AGENT_ROLE_OPTIONS: Record<AgentModelRole, Omit<ChatOptions, 'provider' | 'model' | 'signal'>> = {
  planner: { temperature: 0, maxTokens: 1200, responseFormat: 'json' },
  reflector: { temperature: 0, maxTokens: 1200, responseFormat: 'json' },
  simple_answer: { temperature: 0.2, maxTokens: 1000 },
  risk_sensor: { temperature: 0, maxTokens: 1000, responseFormat: 'json' },
  synthesizer: { temperature: 0.2, maxTokens: 4096 },
  local_paper_analysis: { temperature: 0.2, maxTokens: 4096 },
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
  options: ChatOptions = {},
): Promise<string> {
  const body: Record<string, unknown> = { model, messages: buildOpenAIMessages(messages) }
  if (typeof options.temperature === 'number') body.temperature = options.temperature
  if (typeof options.maxTokens === 'number') body.max_tokens = options.maxTokens
  if (options.responseFormat === 'json') body.response_format = { type: 'json_object' }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: options.signal,
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
  options: ChatOptions = {},
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
      max_tokens: options.maxTokens ?? 4096,
      system: systemMsg?.content,
      messages: buildAnthropicMessages(messages),
    }),
    signal: options.signal,
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
  options: ChatOptions = {},
): Promise<string> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      apiKey,
      model,
      endpoint,
      messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      responseFormat: options.responseFormat,
    }),
    signal: options.signal,
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
  providerOrOptions?: string | ChatOptions,
  signal?: AbortSignal,
): Promise<string> {
  const options: ChatOptions = typeof providerOrOptions === 'string'
    ? { provider: providerOrOptions, signal }
    : { ...(providerOrOptions ?? {}), signal: providerOrOptions?.signal ?? signal }
  const config = await getAiConfig(options.provider)
  if (!config) {
    throw new Error('请先在设置中配置 AI 模型')
  }
  if (config.provider !== 'openai-codex' && !config.api_key) {
    throw new Error('请先在设置中配置 AI API Key')
  }

  const model = options.model || config.default_model || PROVIDERS.find((p) => p.id === config.provider)?.modelHint || ''
  const apiKey = config.api_key ?? ''

  if (!hasTauriInvoke()) {
    if (config.provider === 'custom') {
      const { endpoint, model: customModel } = parseCustomModelField(config.default_model || '')
      const customEndpoint = options.endpoint || endpoint
      if (!customEndpoint) {
        throw new Error('自定义提供商需要在模型字段填写 API 端点 URL（格式：URL 或 URL|模型名）')
      }
      return callDevAiProxy(config.provider, apiKey, options.model || customModel, messages, customEndpoint, options)
    }

    return callDevAiProxy(config.provider, apiKey, model, messages, undefined, options)
  }

  if (config.provider === 'openai-codex') {
    throw new Error('OpenAI Codex OAuth 暂只支持本地 dev server 测试，请使用 http://127.0.0.1:5173/。')
  }

  if (config.provider === 'anthropic') {
    return callAnthropic(apiKey, model, messages, options)
  }

  const endpoint = OPENAI_COMPAT_ENDPOINTS[config.provider]
  if (endpoint) {
    return callOpenAICompat(endpoint, apiKey, model, messages, options)
  }

  if (config.provider === 'custom') {
    const { endpoint: customEndpoint, model: customModel } = parseCustomModelField(config.default_model || '')
    const endpoint = options.endpoint || customEndpoint
    if (!endpoint) {
      throw new Error('自定义提供商需要在模型字段填写 API 端点 URL（格式：URL 或 URL|模型名）')
    }
    return callOpenAICompat(endpoint, apiKey, options.model || customModel, messages, options)
  }

  throw new Error(`不支持的 AI 提供商: ${config.provider}`)
}

export async function chatWithAgentModel(
  messages: ChatMessage[],
  role: AgentModelRole,
  signal?: AbortSignal,
): Promise<string> {
  const config = await getAiConfig()
  if (!config) {
    throw new Error('请先在设置中配置 AI 模型')
  }
  if (config.provider !== 'openai-codex' && !config.api_key) {
    throw new Error('请先在设置中配置 AI API Key')
  }
  const roleOptions = AGENT_ROLE_OPTIONS[role]

  if (config.provider === 'deepseek') {
    return chatWithAI(messages, {
      ...roleOptions,
      provider: 'deepseek',
      model: DEEPSEEK_ROLE_MODELS[role],
      signal,
    })
  }

  return chatWithAI(messages, {
    ...roleOptions,
    provider: config.provider,
    signal,
  })
}
