/**
 * [INPUT]: 依赖 services/tauri
 * [OUTPUT]: 对外提供 saveAiConfig, getAiConfig
 * [POS]: services 层的 AI 配置管理，被设置页面和 AI 面板消费
 */
import { hasTauriInvoke, invokeTauri } from './tauri'

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

const AI_CONFIG_KEY = 'lumen.dev.ai.configs'

function readConfigs(): Record<string, AiConfig> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY)
    return raw ? JSON.parse(raw) as Record<string, AiConfig> : {}
  } catch {
    return {}
  }
}

function writeConfigs(configs: Record<string, AiConfig>): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(configs))
}

export async function saveAiConfig(input: SaveAiConfigInput): Promise<void> {
  if (hasTauriInvoke()) {
    return invokeTauri<void>('save_ai_config', { input })
  }

  const configs = readConfigs()
  const isDefault = input.is_default ?? Object.keys(configs).length === 0
  const updated = Object.fromEntries(
    Object.entries(configs).map(([key, value]) => [key, { ...value, is_default: isDefault ? false : value.is_default }]),
  )
  updated[input.provider] = {
    provider: input.provider,
    api_key: input.api_key,
    default_model: input.default_model ?? null,
    is_default: isDefault,
  }
  writeConfigs(updated)
}

export async function getAiConfig(provider?: string): Promise<AiConfig | null> {
  if (hasTauriInvoke()) {
    return invokeTauri<AiConfig | null>('get_ai_config', { provider: provider ?? null })
  }

  const configs = readConfigs()
  if (provider) return configs[provider] ?? null
  return Object.values(configs).find((config) => config.is_default) ?? Object.values(configs)[0] ?? null
}
