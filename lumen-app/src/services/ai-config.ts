/**
 * [INPUT]: 依赖 @tauri-apps/api/core 的 invoke
 * [OUTPUT]: 对外提供 saveAiConfig, getAiConfig
 * [POS]: services 层的 AI 配置管理，被设置页面和 AI 面板消费
 */
import { invoke } from '@tauri-apps/api/core'

export interface AiConfig {
  provider: string
  api_key: string | null
  default_model: string | null
  is_default: boolean
}

export interface SaveAiConfigInput {
  provider: string
  api_key: string
  default_model?: string
  is_default?: boolean
}

export async function saveAiConfig(input: SaveAiConfigInput): Promise<void> {
  return invoke('save_ai_config', { input })
}

export async function getAiConfig(provider?: string): Promise<AiConfig | null> {
  return invoke('get_ai_config', { provider: provider ?? null })
}
