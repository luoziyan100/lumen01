/**
 * [INPUT]: 依赖 lucide-react 的图标，依赖 react-router-dom 的 useLocation/useNavigate
 * [OUTPUT]: 对外提供 Titlebar 组件
 * [POS]: layout 模块的顶部窗口栏，被 AppShell 消费
 */
import { Settings } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const PAGE_NAMES: Record<string, string> = {
  '/': 'Library',
  '/reader': 'Reader',
  '/research': 'Research',
  '/graph': 'Graph',
  '/settings': 'Settings',
}

export function Titlebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const pageName = PAGE_NAMES[location.pathname]
    || (location.pathname.startsWith('/reader/') ? 'Reader'
    : location.pathname.startsWith('/collection/') ? 'Collection'
    : 'Library')

  return (
    <header
      className="h-[var(--titlebar-h)] flex items-center border-b border-sand select-none"
      style={{
        paddingLeft: 84,
        paddingRight: 12,
        background: 'var(--color-paper)',
        // @ts-expect-error Tauri-specific CSS property
        WebkitAppRegion: 'drag',
      }}
    >
      <div className="flex items-center gap-2 text-ink-soft">
        <span className="text-xs font-medium text-ink">Lumen</span>
        <span className="text-ink-faint">›</span>
        <span className="text-xs">{pageName}</span>
      </div>

      <div className="flex-1" />

      <div
        className="flex items-center gap-1"
        style={{
          // @ts-expect-error Tauri-specific CSS property
          WebkitAppRegion: 'no-drag',
        }}
      >
        <ToolbarButton
          icon={<Settings size={15} />}
          tooltip="设置"
          onClick={() => navigate('/settings')}
        />
      </div>
    </header>
  )
}

function ToolbarButton({ icon, tooltip, onClick }: { icon: React.ReactNode; tooltip: string; onClick?: () => void }) {
  return (
    <button
      title={tooltip}
      onClick={onClick}
      className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-ink-mute hover:text-ink hover:bg-sand/50 cursor-pointer"
      style={{ transition: 'all var(--dur-fast) var(--ease-out)' }}
    >
      {icon}
    </button>
  )
}
