import type { ChatMessage } from '../../services/ai.ts'
import type { AiConfig } from '../../services/ai-config.ts'
import type { AgentMessage, LLMAdapter, LLMResponse, ToolCall, ToolDefinition } from './types.ts'

function describeToolParameters(parameters: Record<string, unknown>): string {
  const properties = parameters.properties
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return '无'
  return Object.keys(properties).join(', ')
}

function buildToolInstruction(tools: ToolDefinition[]): string {
  const toolList = tools.map((tool) => (
    `- ${tool.name}: ${tool.description}\n  参数：${describeToolParameters(tool.parameters)}`
  )).join('\n')

  return [
    '## 可用工具',
    '',
    '你可以调用以下工具。要调用工具，用以下 JSON 格式回复，不要包含其他文字：',
    '',
    '<tool_call>',
    '{"name": "工具名", "arguments": {...}}',
    '</tool_call>',
    '',
    '工具列表：',
    toolList,
    '',
    '如果你不需要调用工具，直接用普通文本回复用户。',
  ].join('\n')
}

function nextToolCallId(): string {
  const randomId = globalThis.crypto?.randomUUID?.()
  return randomId ? `react_${randomId}` : `react_${Date.now()}`
}

function toChatMessage(message: AgentMessage): ChatMessage | null {
  if (message.role === 'tool_result') {
    return {
      role: 'user',
      content: `Observation for ${message.toolCallId ?? 'tool'}:\n${message.content}`,
    }
  }
  if (message.role === 'assistant' && message.toolCalls?.length) {
    return {
      role: 'assistant',
      content: message.content || message.toolCalls.map((toolCall) => (
        `<tool_call>\n${JSON.stringify({ name: toolCall.name, arguments: toolCall.arguments })}\n</tool_call>`
      )).join('\n\n'),
    }
  }
  const converted: ChatMessage = {
    role: message.role,
    content: message.content,
  }
  if (message.images?.length) converted.images = message.images
  return converted
}

export function buildReActMessages(messages: AgentMessage[], tools: ToolDefinition[]): ChatMessage[] {
  const systemMessages = messages.filter((message) => message.role === 'system')
  const nonSystemMessages = messages.filter((message) => message.role !== 'system')
  const baseSystem = systemMessages.map((message) => message.content.trim()).filter(Boolean).join('\n\n')
  const injectedSystem = [baseSystem, buildToolInstruction(tools)].filter(Boolean).join('\n\n')
  const converted = nonSystemMessages.map(toChatMessage).filter((message): message is ChatMessage => Boolean(message))
  return [
    { role: 'system', content: injectedSystem },
    ...converted,
  ]
}

export function parseReActResponse(text: string, id = nextToolCallId()): LLMResponse {
  const match = text.match(/<tool_call>([\s\S]*?)<\/tool_call>/)
  if (!match) {
    return {
      text,
      message: { role: 'assistant', content: text },
    }
  }

  try {
    const parsed = JSON.parse(match[1].trim()) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('tool_call must be an object')
    const toolCallPayload = parsed as { name?: unknown; arguments?: unknown }
    if (typeof toolCallPayload.name !== 'string') throw new Error('tool_call name must be a string')
    const args = toolCallPayload.arguments
    const toolCall: ToolCall = {
      id,
      name: toolCallPayload.name,
      arguments: args && typeof args === 'object' && !Array.isArray(args) ? args as Record<string, unknown> : {},
    }
    return {
      toolCalls: [toolCall],
      message: {
        role: 'assistant',
        content: text,
        toolCalls: [toolCall],
      },
    }
  } catch {
    return {
      text,
      message: { role: 'assistant', content: text },
    }
  }
}

export class ReActFallbackAdapter implements LLMAdapter {
  private readonly config: AiConfig

  constructor(config: AiConfig) {
    this.config = config
  }

  async chatWithTools(
    messages: AgentMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    const { chatWithAI } = await import('../../services/ai.ts')
    const response = await chatWithAI(buildReActMessages(messages, tools), {
      provider: this.config.provider,
      model: this.config.default_model ?? undefined,
      signal,
    })
    return parseReActResponse(response)
  }
}
