import type { ReactNode } from 'react'
import type { Role } from '../types'
import { roleLabel } from '../utils/roles'
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
  | 'organizations'
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
  { key: 'dashboard', label: 'Dashboard', icon: 'DB', roles: ['normal_user', 'organization_user', 'graduate', 'org_admin', 'admin', 'super_admin'] },
  { key: 'profile', label: 'Profile', icon: 'PF', roles: ['normal_user', 'organization_user', 'graduate'] },
  { key: 'submit', label: 'Take Assessment', icon: 'TA', roles: ['normal_user', 'organization_user', 'graduate'] },
  { key: 'assessments', label: 'Assessment History', icon: 'AH', roles: ['normal_user', 'organization_user', 'graduate'] },
  { key: 'assessments', label: 'View Assessments', icon: 'VA', roles: ['org_admin', 'admin', 'super_admin'] },
  { key: 'results', label: 'Gap Results', icon: 'GR', roles: ['normal_user', 'organization_user', 'graduate'] },
  { key: 'recommendations', label: 'Recommendations', icon: 'RC', roles: ['normal_user', 'organization_user', 'graduate'] },
  { key: 'users', label: 'Users', icon: 'US', roles: ['org_admin', 'admin', 'super_admin'] },
  { key: 'organizations', label: 'Organizations', icon: 'OR', roles: ['admin', 'super_admin'] },
  { key: 'competencies', label: 'Competencies', icon: 'CP', roles: ['admin', 'super_admin'] },
  { key: 'benchmarks', label: 'RTB Benchmarks', icon: 'BM', roles: ['admin', 'super_admin'] },
  { key: 'reports', label: 'Reports', icon: 'RP', roles: ['normal_user', 'organization_user', 'graduate', 'org_admin', 'admin', 'super_admin'] },
  { key: 'notifications', label: 'Notifications', icon: 'NT', roles: ['normal_user', 'organization_user', 'graduate'] },
  { key: 'notifications', label: 'Manage Notifications', icon: 'MN', roles: ['admin', 'super_admin'] },
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
            <Badge
              aria-label={`Current account role: ${roleLabel(user.role)}`}
              className="topbar-role"
              tone="role"
            >
              {roleLabel(user.role)}
            </Badge>
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
