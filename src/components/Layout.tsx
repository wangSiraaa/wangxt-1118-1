import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ClipboardList,
  FlaskConical,
  Warehouse,
  Trash2,
  Bell,
  ChevronDown,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { UserRole } from '@/types'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: '首页', icon: LayoutDashboard },
  { to: '/register', label: '收样登记', icon: ClipboardList },
  { to: '/testing', label: '检测录入', icon: FlaskConical },
  { to: '/warehouse', label: '库位管理', icon: Warehouse },
  { to: '/disposal', label: '处置管理', icon: Trash2 },
  { to: '/reminder', label: '催办清单', icon: Bell },
]

const roles: UserRole[] = ['收样员', '检测工程师', '库管', '管理员']

export default function Layout() {
  const { currentUser, switchRole, reminders } = useStore()
  const location = useLocation()
  const overdueCount = reminders.filter((r) => r.status !== '已完结').length

  return (
    <div className="flex h-screen bg-slate-100">
      <aside className="w-56 flex-shrink-0 bg-deep-blue text-white flex flex-col">
        <div className="h-14 flex items-center px-5 border-b border-white/10">
          <div className="text-lg font-bold tracking-wide">留置样品处置</div>
        </div>
        <nav className="flex-1 py-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 px-5 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                )}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {item.label === '催办清单' && overdueCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                    {overdueCount}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>
        <div className="p-4 border-t border-white/10 text-xs text-slate-400">
          海关实验室 v1.0
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <h1 className="text-base font-semibold text-slate-800">
            海关实验室留置样品处置系统
          </h1>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <button className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-md border border-slate-200">
                <span>{currentUser.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-deep-blue text-white">
                  {currentUser.role}
                </span>
                <ChevronDown size={14} />
              </button>
              <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 hidden group-hover:block z-50">
                {roles.map((role) => (
                  <button
                    key={role}
                    onClick={() => switchRole(role)}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm hover:bg-slate-50',
                      currentUser.role === role
                        ? 'text-deep-blue font-medium'
                        : 'text-slate-600'
                    )}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
