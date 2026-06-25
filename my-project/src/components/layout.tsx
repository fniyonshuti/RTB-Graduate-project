import type { ReactNode } from 'react'
import type { Role } from '../types'
import { Badge, Button } from './common'

type ViewKey =
  | 'dashboard'
  | 'profile'
  | 'submit'
  | 'assessments'
  | 'results'
  | 'reports'
  | 'notifications'
  | 'users'
  | 'competencies'
  | 'benchmarks'
  | 'recommendations'

type NavItem = {
  key: ViewKey
  label: string
  icon: string
  roles: Role[]
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'DB', roles: ['graduate', 'assessor', 'admin'] },
  { key: 'profile', label: 'Profile', icon: 'PF', roles: ['graduate'] },
  { key: 'submit', label: 'Take Assessment', icon: 'TA', roles: ['graduate'] },
  { key: 'assessments', label: 'Assessment History', icon: 'AH', roles: ['graduate'] },
  { key: 'assessments', label: 'Assessment Reviews', icon: 'AR', roles: ['assessor'] },
  { key: 'assessments', label: 'View Assessments', icon: 'VA', roles: ['admin'] },
  { key: 'results', label: 'Gap Results', icon: 'GR', roles: ['graduate'] },
  { key: 'recommendations', label: 'Recommendations', icon: 'RC', roles: ['assessor'] },
  { key: 'users', label: 'Users', icon: 'US', roles: ['admin'] },
  { key: 'competencies', label: 'Competencies', icon: 'CP', roles: ['admin'] },
  { key: 'benchmarks', label: 'RTB Benchmarks', icon: 'BM', roles: ['admin'] },
  { key: 'reports', label: 'Reports', icon: 'RP', roles: ['graduate', 'assessor', 'admin'] },
  { key: 'notifications', label: 'Notifications', icon: 'NT', roles: ['graduate', 'assessor'] },
  { key: 'notifications', label: 'Manage Notifications', icon: 'MN', roles: ['admin'] },
]

export function getDefaultView(role: Role): ViewKey {
  if (role === 'admin') return 'dashboard'
  if (role === 'assessor') return 'dashboard'
  return 'dashboard'
}

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
  user: { name: string; role: Role; institution?: string }
  onLogout: () => void
}) {
  const visibleItems = navItems.filter((item) => item.roles.includes(user.role))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">RTB</div>
          <div>
            <strong>Skills Gap Tool</strong>
            <span>Kicukiro TVET ICT</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Main navigation">
          {visibleItems.map((item) => (
            <button
              className={item.key === currentView ? 'active' : ''}
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div>
            <strong>{user.name}</strong>
            <span>{user.institution || 'Skills Gap Analysis Tool'}</span>
          </div>
          <div className="topbar-actions">
            <Badge tone="role">{user.role}</Badge>
            <Button variant="ghost" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}

export type { ViewKey }
