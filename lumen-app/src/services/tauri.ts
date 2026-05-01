/**
 * [INPUT]: 依赖 @tauri-apps/api/core
 * [OUTPUT]: 对外提供 Tauri invoke 可用性检测与安全调用封装
 * [POS]: services 层的运行时适配工具，让 Vite 浏览器预览不会误调用 Tauri API
 */
import { invoke } from '@tauri-apps/api/core'

export function hasTauriInvoke(): boolean {
  return typeof window !== 'undefined'
    && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
}

export function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!hasTauriInvoke()) {
    return Promise.reject(new Error('Tauri invoke is unavailable in this browser context'))
  }

  return invoke<T>(command, args)
}
