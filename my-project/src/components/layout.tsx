import type { ReactNode } from 'react'
import {
  BarChart3,
  Bell,
  BookOpenCheck,
  ClipboardCheck,
  FileText,
  Gauge,
  Landmark,
  LayoutDashboard,
  LogOut,
  Mail,
  Settings,
  Target,
  UserCog,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '../types'
import { roleLabel } from '../utils/roles'

type ViewKey =
  | 'dashboard'
  | 'profile'
  | 'submit'
  | 'assessments'
  | 'results'
  | 'reports'
  | 'notifications'
  | 'users'
  | 'organizations'
  | 'competencies'
  | 'benchmarks'
  | 'recommendations'

type NavItem = {
  key: ViewKey
  label: string
  icon: LucideIcon
  roles: Role[]
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['normal_user', 'organization_user', 'org_admin', 'admin', 'super_admin'] },
  { key: 'profile', label: 'Profile', icon: UserRound, roles: ['normal_user', 'organization_user'] },
  { key: 'submit', label: 'Take Assessment', icon: ClipboardCheck, roles: ['normal_user', 'organization_user'] },
  { key: 'assessments', label: 'Assessment History', icon: BookOpenCheck, roles: ['normal_user', 'organization_user'] },
  { key: 'assessments', label: 'View Assessments', icon: BookOpenCheck, roles: ['org_admin', 'admin', 'super_admin'] },
  { key: 'results', label: 'Gap Results', icon: Target, roles: ['normal_user', 'organization_user'] },
  { key: 'recommendations', label: 'Recommendations', icon: Gauge, roles: ['normal_user', 'organization_user'] },
  { key: 'users', label: 'Users', icon: Users, roles: ['org_admin', 'admin', 'super_admin'] },
  { key: 'organizations', label: 'Organizations', icon: Landmark, roles: ['admin', 'super_admin'] },
  { key: 'competencies', label: 'Competencies', icon: Settings, roles: ['admin', 'super_admin'] },
  { key: 'benchmarks', label: 'RTB Benchmarks', icon: BarChart3, roles: ['admin', 'super_admin'] },
  { key: 'reports', label: 'Reports', icon: FileText, roles: ['normal_user', 'organization_user'] },
  { key: 'notifications', label: 'Notifications', icon: Bell, roles: ['normal_user', 'organization_user'] },
  { key: 'notifications', label: 'Manage Notifications', icon: Bell, roles: ['admin', 'super_admin'] },
]

export function AppLayout({
  children,
  currentView,
  onNavigate,
  user,
  onLogout,
}: {
  children: ReactNode
  currentView: ViewKey
  onNavigate: (view: ViewKey) => void
  user: { name: string; email?: string; role: Role; institution?: string }
  onLogout: () => void
}) {
  const visibleItems = navItems.filter((item) => item.roles.includes(user.role))
  const canUpdateProfile = visibleItems.some((item) => item.key === 'profile')
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U'

  return (
    <div className="grid min-h-screen grid-cols-[286px_minmax(0,1fr)] bg-gradient-to-br from-slate-50 via-white to-slate-100 max-[1180px]:grid-cols-1">
      <aside className="sticky top-0 h-screen overflow-y-auto border-r border-white/10 bg-gradient-to-b from-[#1F2937] via-slate-900 to-blue-950 p-6 text-slate-200 shadow-2xl shadow-slate-900/10 max-[1180px]:static max-[1180px]:h-auto max-[720px]:p-4">
        <div className="mb-8 flex min-w-0 items-center gap-4 max-[1180px]:mb-5">
          <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white shadow-lg shadow-blue-500/10">
            <img
              className="h-full w-full object-contain p-1"
              src="/competra-icon.png"
              alt="Competra logo"
            />
          </div>
          <div className="min-w-0">
            <strong className="block truncate text-white">Competra</strong>
            <span className="block truncate text-sm text-slate-400">Competency tracking</span>
          </div>
        </div>

        <nav className="grid gap-3 max-[1180px]:flex max-[1180px]:overflow-x-auto max-[1180px]:pb-1" aria-label="Main navigation">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
            <button
              className={`flex min-h-11 min-w-0 items-center gap-3 rounded-lg border px-3.5 py-3 text-left font-black transition duration-200 max-[1180px]:min-w-max ${
                item.key === currentView
                  ? 'border-blue-300/20 bg-white/10 text-white shadow-inner shadow-white/5'
                  : 'border-transparent text-slate-300 hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/5 hover:text-white'
              }`}
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
            >
              <span className={`inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border ${
                item.key === currentView
                  ? 'border-blue-300/30 bg-blue-300/15 text-blue-100'
                  : 'border-white/10 bg-white/10 text-blue-200'
              }`} aria-hidden="true">
                <Icon size={18} />
              </span>
              <span>{item.label}</span>
            </button>
          )})}
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex min-w-0 items-center justify-between gap-5 border-b border-slate-200/80 bg-white/90 px-8 py-5 shadow-sm shadow-slate-200/60 backdrop-blur-xl max-[720px]:items-stretch max-[720px]:gap-3 max-[720px]:px-4">
          <div className="min-w-0">
            <strong className="block truncate text-lg font-black text-slate-950">{user.name}</strong>
            <span className="block truncate text-sm text-slate-500">{user.institution || 'Competra ICT readiness'}</span>
          </div>
          <div className="flex flex-none items-center justify-end gap-3 max-[720px]:items-start">
            <div className="group relative flex justify-end">
              <button
                aria-label="Open account menu"
                className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-gradient-to-br from-blue-600 to-emerald-500 font-black text-white shadow-md shadow-blue-900/10 ring-4 ring-white transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-blue-100"
                type="button"
              >
                {initials || <UserRound size={20} />}
              </button>

              <div className="invisible absolute right-0 top-full z-30 mt-3 w-80 translate-y-2 rounded-lg border border-slate-200 bg-white p-3 opacity-0 shadow-2xl shadow-slate-900/15 transition duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 max-[720px]:right-0 max-[720px]:w-[min(20rem,calc(100vw-2rem))]">
                <div className="flex items-start gap-3 rounded-lg bg-gradient-to-br from-slate-50 to-blue-50 p-3">
                  <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-blue-700 font-black text-white">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <strong className="block truncate text-slate-950">{user.name}</strong>
                    <span className="mt-1 inline-flex items-center gap-1 truncate text-sm font-bold text-slate-500">
                      <Mail size={14} />
                      {user.email || 'Email not available'}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid gap-2">
                  <button
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-black text-slate-700 transition hover:bg-slate-50 hover:text-blue-800"
                    type="button"
                    onClick={() => onNavigate('dashboard')}
                  >
                    <LayoutDashboard size={17} />
                    Dashboard
                  </button>
                  {canUpdateProfile && (
                    <button
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-black text-slate-700 transition hover:bg-blue-50 hover:text-blue-800"
                      type="button"
                      onClick={() => onNavigate('profile')}
                    >
                      <UserCog size={17} />
                      Update profile
                    </button>
                  )}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <span className="block font-black text-slate-500">Account role</span>
                    <strong className="text-slate-950">{roleLabel(user.role)}</strong>
                  </div>
                  <button
                    className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-left text-sm font-black text-rose-700 transition hover:bg-rose-100"
                    type="button"
                    onClick={onLogout}
                  >
                    <LogOut size={17} />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="grid min-w-0 gap-7 p-8 max-[900px]:gap-6 max-[900px]:p-5 max-[720px]:gap-4 max-[720px]:p-4">{children}</main>
      </div>
    </div>
  )
}

export type { ViewKey }
