import type { ImageData } from '../../services/ai'

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool_result'
  content: string
  toolCalls?: ToolCall[]
  toolCallId?: string
  images?: ImageData[]
}

export interface LLMResponse {
  text?: string
  toolCalls?: ToolCall[]
  message: AgentMessage
}

export interface LLMAdapter {
  chatWithTools(
    messages: AgentMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): Promise<LLMResponse>
}
