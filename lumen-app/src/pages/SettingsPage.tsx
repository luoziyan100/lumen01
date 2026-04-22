/**
 * [INPUT]: 依赖 services/ai-config, services/ai
 * [OUTPUT]: 对外提供 SettingsPage 页面组件
 * [POS]: pages 模块的设置页面，挂载在 /settings 路由
 */
import { useState, useEffect, useCallback } from 'react'
import { saveAiConfig, getAiConfig, type AiConfig } from '../services/ai-config'
import { PROVIDERS } from '../services/ai'
import { Check } from 'lucide-react'

export function SettingsPage() {
  const [provider, setProvider] = useState('openai')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [existing, setExisting] = useState<AiConfig | null>(null)

  const providerDef = PROVIDERS.find((p) => p.id === provider)

  useEffect(() => {
    getAiConfig(provider).then((config) => {
      setExisting(config)
      setApiKey(config?.api_key ?? '')
      setModel(config?.default_model ?? '')
    })
  }, [provider])

  const handleSave = useCallback(async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      await saveAiConfig({
        provider,
        api_key: apiKey.trim(),
        default_model: model || undefined,
        is_default: true,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [provider, apiKey, model])

  const maskedKey = existing?.api_key
    ? existing.api_key.slice(0, 6) + '••••••' + existing.api_key.slice(-4)
    : null

  return (
    <div className="flex-1 overflow-auto p-8">
      <h1>设置</h1>

      <section className="mt-8 max-w-lg">
        <h2>AI 模型配置</h2>
        <p className="t-body-sm mt-1">
          配置 AI 提供商的 API Key 和默认模型
        </p>

        <div className="mt-6 flex flex-col gap-5">
          {/* 提供商选择 */}
          <div>
            <label className="t-caption block mb-1.5">提供商</label>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`px-3 py-1.5 rounded-[var(--radius-sm)] t-body-sm cursor-pointer border ${
                    provider === p.id
                      ? 'border-ember text-ember font-medium'
                      : 'border-sand text-ink-soft hover:border-ink-faint'
                  }`}
                  style={{ transition: 'all var(--dur-fast) var(--ease-out)' }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="t-caption block mb-1.5">API Key</label>
            {maskedKey && apiKey === existing?.api_key && (
              <p className="t-mono text-[11px] mb-1.5">
                当前: {maskedKey}
              </p>
            )}
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={providerDef?.placeholder}
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-sand t-body focus:border-ember outline-none"
              style={{
                background: 'var(--color-vellum)',
                transition: 'border-color var(--dur-fast) var(--ease-out)',
              }}
            />
          </div>

          {/* 模型 ID */}
          {provider !== 'custom' && (
            <div>
              <label className="t-caption block mb-1.5">模型 ID</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={providerDef?.modelHint}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-sand t-body focus:border-ember outline-none"
                style={{
                  background: 'var(--color-vellum)',
                  transition: 'border-color var(--dur-fast) var(--ease-out)',
                }}
              />
              <p className="t-caption mt-1">填写模型厂商提供的模型 ID，留空则使用 {providerDef?.modelHint}</p>
            </div>
          )}

          {/* 自定义端点 */}
          {provider === 'custom' && (
            <div>
              <label className="t-caption block mb-1.5">API 端点（OpenAI 兼容）</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="https://your-api.com/v1/chat/completions"
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-sand t-body focus:border-ember outline-none"
                style={{
                  background: 'var(--color-vellum)',
                  transition: 'border-color var(--dur-fast) var(--ease-out)',
                }}
              />
              <p className="t-caption mt-1">支持所有 OpenAI 兼容的 API 端点</p>
            </div>
          )}

          {/* 保存 */}
          <div>
            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] text-white font-medium cursor-pointer disabled:opacity-50 disabled:cursor-default"
              style={{
                background: 'var(--color-ember)',
                fontSize: 'var(--t-body)',
                transition: 'opacity var(--dur-fast) var(--ease-out)',
              }}
            >
              {saved ? (
                <>
                  <Check size={14} />
                  已保存
                </>
              ) : (
                saving ? '保存中...' : '保存'
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
