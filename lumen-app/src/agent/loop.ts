import type { LLMAdapter, AgentMessage } from './adapters/types.ts'
import { createAdapter } from './adapters/adapter-factory.ts'
import { buildSystemPrompt } from './system-prompt.ts'
import { RESEARCH_TOOLS } from './tools/definitions.ts'
import { executeResearchTool, type ToolExecutionContext } from './tools/executor.ts'
import { createAgentRun, failAgentRun, finishAgentRun, recordAgentStep } from './traces.ts'
import type { AgentRun } from './types.ts'

export interface AgentLoopInput {
  userText: string
  images?: AgentMessage['images']
  conversationHistory: AgentMessage[]
  context: {
    currentDate: string
    timezone: string
    hasLocalPapers: boolean
    localPaperCount: number
  }
  loadLocalPaperContext?: (query: string) => Promise<string>
  signal?: AbortSignal
  adapter?: LLMAdapter
  executeTool?: typeof executeResearchTool
}

export interface AgentLoopResult {
  reply: string
  newMessages: AgentMessage[]
  trace: AgentRun
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

export async function runAgentLoop(input: AgentLoopInput): Promise<AgentLoopResult> {
  const trace = createAgentRun(input.userText)
  const adapter = input.adapter ?? await createAdapter()
  const executeTool = input.executeTool ?? executeResearchTool
  const messages: AgentMessage[] = [
    { role: 'system', content: buildSystemPrompt(input.context) },
    ...input.conversationHistory,
    { role: 'user', content: input.userText, images: input.images },
  ]
  const newMessages: AgentMessage[] = []

  try {
    for (let step = 0; step < 10; step += 1) {
      abortIfNeeded(input.signal)
      const response = await recordAgentStep(trace, 'model', `model-step-${step + 1}`, {
        messages: messages.length,
        tools: RESEARCH_TOOLS.map((tool) => tool.name),
      }, () => adapter.chatWithTools(messages, RESEARCH_TOOLS, input.signal))
      newMessages.push(response.message)
      messages.push(response.message)

      const toolCalls = response.toolCalls ?? response.message.toolCalls ?? []
      if (toolCalls.length === 0) {
        finishAgentRun(trace)
        return {
          reply: response.text ?? response.message.content,
          newMessages,
          trace,
        }
      }

      const context: ToolExecutionContext = {
        conversationHistory: messages,
        loadLocalPaperContext: input.loadLocalPaperContext,
      }
      for (const toolCall of toolCalls.slice(0, 3)) {
        abortIfNeeded(input.signal)
        const result = await recordAgentStep(trace, 'tool', toolCall.name, toolCall.arguments, () => (
          executeTool(toolCall, context, input.signal)
        ))
        const toolMessage: AgentMessage = {
          role: 'tool_result',
          toolCallId: toolCall.id,
          content: JSON.stringify(result),
        }
        newMessages.push(toolMessage)
        messages.push(toolMessage)
        context.conversationHistory = messages
      }
    }

    finishAgentRun(trace)
    return {
      reply: '研究步骤过多，请缩小问题范围。',
      newMessages,
      trace,
    }
  } catch (error) {
    failAgentRun(trace, error)
    throw error
  }
}
