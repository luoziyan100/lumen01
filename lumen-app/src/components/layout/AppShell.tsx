/**
 * [INPUT]: 依赖 Titlebar 和 Sidebar 组件
 * [OUTPUT]: 对外提供 AppShell 组件
 * [POS]: layout 模块的根容器，包裹整个应用，被 App.tsx 消费
 */
import { Outlet } from 'react-router-dom'
import { Titlebar } from './Titlebar'
import { Sidebar } from './Sidebar'

export function AppShell() {
  return (
    <div className="w-full h-screen flex flex-col overflow-hidden bg-paper">
      <Titlebar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
