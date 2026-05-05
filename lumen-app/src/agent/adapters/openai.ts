import type { AiConfig } from '../../services/ai-config.ts'
import type { AgentMessage, LLMAdapter, LLMResponse, ToolDefinition } from './types.ts'
import { ReActFallbackAdapter } from './react-fallback.ts'

type OpenAIMessage =
  | { role: 'system' | 'user'; content: string | Array<Record<string, unknown>> }
  | {
    role: 'assistant'
    content: string | null
    tool_calls?: Array<{
      id: string
      type: 'function'
      function: { name: string; arguments: string }
    }>
  }
  | { role: 'tool'; tool_call_id: string; content: string }

interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

interface OpenAIRequest {
  model: string
  messages: OpenAIMessage[]
  tools: OpenAITool[]
}

interface OpenAIResponseToolCall {
  id?: string
  type?: string
  function?: {
    name?: string
    arguments?: string
  }
}

interface OpenAIResponseMessage {
  role?: string
  content?: string | null
  tool_calls?: OpenAIResponseToolCall[]
}

interface OpenAIResponseBody {
  choices?: Array<{
    message?: OpenAIResponseMessage
    finish_reason?: string
  }>
}

function buildOpenAIContent(message: AgentMessage): string | Array<Record<string, unknown>> {
  if (!message.images?.length) return message.content
  return [
    { type: 'text', text: message.content },
    ...message.images.map((image) => ({
      type: 'image_url',
      image_url: { url: `data:${image.mediaType};base64,${image.base64}` },
    })),
  ]
}

function parseArguments(value: string | undefined): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export function buildOpenAIRequest(
  messages: AgentMessage[],
  tools: ToolDefinition[],
  model: string,
): OpenAIRequest {
  return {
    model,
    messages: messages.map((message): OpenAIMessage => {
      if (message.role === 'tool_result') {
        return {
          role: 'tool',
          tool_call_id: message.toolCallId ?? '',
          content: message.content,
        }
      }
      if (message.role === 'assistant') {
        const toolCalls = message.toolCalls?.map((toolCall) => ({
          id: toolCall.id,
          type: 'function' as const,
          function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.arguments),
          },
        }))
        return {
          role: 'assistant',
          content: message.content || null,
          ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
        }
      }
      return {
        role: message.role,
        content: buildOpenAIContent(message),
      }
    }),
    tools: tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    })),
  }
}

export function parseOpenAIResponse(body: OpenAIResponseBody): LLMResponse {
  const message = body.choices?.[0]?.message
  const content = typeof message?.content === 'string' ? message.content : ''
  const toolCalls = (message?.tool_calls ?? [])
    .filter((toolCall) => toolCall.type === 'function' && toolCall.id && toolCall.function?.name)
    .map((toolCall) => ({
      id: toolCall.id as string,
      name: toolCall.function?.name as string,
      arguments: parseArguments(toolCall.function?.arguments),
    }))

  const response: LLMResponse = {
    message: {
      role: 'assistant',
      content,
      ...(toolCalls.length ? { toolCalls } : {}),
    },
  }
  if (content) response.text = content
  if (toolCalls.length) response.toolCalls = toolCalls
  return response
}

export class OpenAIAdapter implements LLMAdapter {
  private readonly config: AiConfig
  private readonly fallback: ReActFallbackAdapter

  constructor(config: AiConfig) {
    this.config = config
    this.fallback = new ReActFallbackAdapter(config)
  }

  async chatWithTools(
    messages: AgentMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    if (this.config.provider === 'openai-codex') {
      return this.fallback.chatWithTools(messages, tools, signal)
    }
    if (!this.config.api_key) throw new Error('请先在设置中配置 OpenAI API Key')

    const model = this.config.default_model || 'gpt-4o-mini'
    const request = buildOpenAIRequest(messages, tools, model)
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.api_key}`,
        },
        body: JSON.stringify(request),
        signal,
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`OpenAI 请求失败 (${response.status}): ${body}`)
      }

      return parseOpenAIResponse(await response.json() as OpenAIResponseBody)
    } catch (error) {
      if (this.config.provider === 'openai-codex') {
        return this.fallback.chatWithTools(messages, tools, signal)
      }
      throw error
    }
  }
}
