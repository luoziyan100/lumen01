import { ClaudeAdapter } from './claude.ts'
import { OpenAIAdapter } from './openai.ts'
import { ReActFallbackAdapter } from './react-fallback.ts'
import type { LLMAdapter } from './types.ts'

export async function createAdapter(): Promise<LLMAdapter> {
  const { getAiConfig } = await import('../../services/ai-config.ts')
  const config = await getAiConfig()
  if (!config) throw new Error('请先在设置中配置 AI 模型')

  switch (config.provider) {
    case 'anthropic':
      return new ClaudeAdapter(config)
    case 'openai':
    case 'openai-codex':
      return new OpenAIAdapter(config)
    case 'deepseek':
    case 'custom':
      return new ReActFallbackAdapter(config)
    default:
      return new ReActFallbackAdapter(config)
  }
}
