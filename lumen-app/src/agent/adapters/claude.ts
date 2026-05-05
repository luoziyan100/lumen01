import type { AiConfig } from '../../services/ai-config.ts'
import type { AgentMessage, LLMAdapter, LLMResponse, ToolCall, ToolDefinition } from './types.ts'

type ClaudeRole = 'user' | 'assistant'
type ClaudeTextBlock = { type: 'text'; text: string }
type ClaudeImageBlock = { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
type ClaudeToolUseBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
type ClaudeToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string }
type ClaudeContentBlock = ClaudeTextBlock | ClaudeImageBlock | ClaudeToolUseBlock | ClaudeToolResultBlock
type ClaudeMessage = { role: ClaudeRole; content: string | ClaudeContentBlock[] }

interface ClaudeTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

interface ClaudeRequest {
  model: string
  max_tokens: number
  system?: string
  tools: ClaudeTool[]
  messages: ClaudeMessage[]
}

interface ClaudeResponseBlock {
  type?: string
  text?: string
  id?: string
  name?: string
  input?: unknown
}

interface ClaudeResponseBody {
  content?: ClaudeResponseBlock[]
}

function objectFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function appendClaudeToolResult(messages: ClaudeMessage[], block: ClaudeToolResultBlock): void {
  const last = messages[messages.length - 1]
  if (last?.role === 'user' && Array.isArray(last.content) && last.content.every((item) => item.type === 'tool_result')) {
    last.content.push(block)
    return
  }
  messages.push({ role: 'user', content: [block] })
}

function claudeContentForMessage(message: AgentMessage): string | ClaudeContentBlock[] {
  if (!message.toolCalls?.length && !message.images?.length) return message.content

  const blocks: ClaudeContentBlock[] = []
  for (const image of message.images ?? []) {
    blocks.push({
      type: 'image',
      source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
    })
  }
  if (message.content.trim()) blocks.push({ type: 'text', text: message.content })
  for (const toolCall of message.toolCalls ?? []) {
    blocks.push({
      type: 'tool_use',
      id: toolCall.id,
      name: toolCall.name,
      input: toolCall.arguments,
    })
  }
  return blocks.length ? blocks : message.content
}

export function buildClaudeRequest(
  messages: AgentMessage[],
  tools: ToolDefinition[],
  model: string,
  maxTokens = 4096,
): ClaudeRequest {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n')
  const claudeMessages: ClaudeMessage[] = []

  for (const message of messages) {
    if (message.role === 'system') continue
    if (message.role === 'tool_result') {
      appendClaudeToolResult(claudeMessages, {
        type: 'tool_result',
        tool_use_id: message.toolCallId ?? '',
        content: message.content,
      })
      continue
    }
    claudeMessages.push({
      role: message.role,
      content: claudeContentForMessage(message),
    })
  }

  return {
    model,
    max_tokens: maxTokens,
    system: system || undefined,
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    })),
    messages: claudeMessages,
  }
}

export function parseClaudeResponse(body: ClaudeResponseBody): LLMResponse {
  const textBlocks: string[] = []
  const toolCalls: ToolCall[] = []

  for (const block of body.content ?? []) {
    if (block.type === 'text' && typeof block.text === 'string') {
      textBlocks.push(block.text)
    }
    if (
      block.type === 'tool_use'
      && typeof block.id === 'string'
      && typeof block.name === 'string'
    ) {
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: objectFromUnknown(block.input),
      })
    }
  }

  const text = textBlocks.join('\n').trim()
  const response: LLMResponse = {
    message: {
      role: 'assistant',
      content: text,
      ...(toolCalls.length ? { toolCalls } : {}),
    },
  }
  if (text) response.text = text
  if (toolCalls.length) response.toolCalls = toolCalls
  return response
}

export class ClaudeAdapter implements LLMAdapter {
  private readonly config: AiConfig

  constructor(config: AiConfig) {
    this.config = config
  }

  async chatWithTools(
    messages: AgentMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    if (!this.config.api_key) throw new Error('请先在设置中配置 Claude API Key')
    const model = this.config.default_model || 'claude-sonnet-4-20250514'
    const request = buildClaudeRequest(messages, tools, model)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.api_key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(request),
      signal,
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`Claude 请求失败 (${response.status}): ${body}`)
    }

    return parseClaudeResponse(await response.json() as ClaudeResponseBody)
  }
}
