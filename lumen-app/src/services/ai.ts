/**
 * [INPUT]: 依赖 ai-config service
 * [OUTPUT]: 对外提供 chatWithAI, PROVIDERS, ChatMessage 类型
 * [POS]: services 层的 AI 对话，支持多提供商 API，被 AI 面板和翻译浮层消费
 */
import { getAiConfig } from './ai-config'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
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

async function callOpenAICompat(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`AI 请求失败 (${res.status}): ${body}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  const systemMsg = messages.find((m) => m.role === 'system')
  const nonSystemMsgs = messages.filter((m) => m.role !== 'system')

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
      messages: nonSystemMsgs.map((m) => ({ role: m.role, content: m.content })),
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Claude 请求失败 (${res.status}): ${body}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

export async function chatWithAI(
  messages: ChatMessage[],
  provider?: string,
): Promise<string> {
  const config = await getAiConfig(provider)
  if (!config?.api_key) {
    throw new Error('请先在设置中配置 AI API Key')
  }

  const model = config.default_model || PROVIDERS.find((p) => p.id === config.provider)?.modelHint || ''

  if (config.provider === 'anthropic') {
    return callAnthropic(config.api_key, model, messages)
  }

  const endpoint = OPENAI_COMPAT_ENDPOINTS[config.provider]
  if (endpoint) {
    return callOpenAICompat(endpoint, config.api_key, model, messages)
  }

  if (config.provider === 'custom') {
    const customEndpoint = config.default_model?.includes('http')
      ? config.default_model
      : null
    if (!customEndpoint) {
      throw new Error('自定义提供商需要在模型字段填写完整的 API 端点 URL')
    }
    return callOpenAICompat(customEndpoint, config.api_key, model, messages)
  }

  throw new Error(`不支持的 AI 提供商: ${config.provider}`)
}
