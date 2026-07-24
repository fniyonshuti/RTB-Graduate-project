import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, LoadingState, TextField } from './components/common'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppLayout, canAccessView, type ViewKey } from './components/layout'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import { AuthPages } from './pages/AuthPages'
import { getPasswordPolicy, passwordPolicyMessage } from './utils/passwordPolicy'
import { isLearnerRole } from './utils/roles'
import './index.css'
import type * as MainPagesModule from './pages/MainPages'

// The authenticated pages (dashboard, assessments, reports, admin screens...)
// account for most of the app's JS but are useless until login succeeds.
// Loading them as their own chunk keeps the login screen's first paint fast;
// every lazy() below points at the same module specifier, so bundlers fetch
// it once as a single chunk regardless of how many named exports are used.
function lazyPage<Name extends keyof typeof MainPagesModule>(name: Name) {
  return lazy(() =>
    import('./pages/MainPages').then((module) => ({ default: module[name] })),
  ) as (typeof MainPagesModule)[Name]
}

const AssessmentsPage = lazyPage('AssessmentsPage')
const BenchmarksPage = lazyPage('BenchmarksPage')
const CompetenciesPage = lazyPage('CompetenciesPage')
const DashboardPage = lazyPage('DashboardPage')
const RepositoryChecklistsPage = lazyPage('RepositoryChecklistsPage')
const GapResultsPage = lazyPage('GapResultsPage')
const GraduateProfilePage = lazyPage('GraduateProfilePage')
const NotificationsPage = lazyPage('NotificationsPage')
const OrganizationsPage = lazyPage('OrganizationsPage')
const RecommendationsPage = lazyPage('RecommendationsPage')
const LegalPoliciesPage = lazyPage('LegalPoliciesPage')
const ReportsPage = lazyPage('ReportsPage')
const SubmitAssessmentPage = lazyPage('SubmitAssessmentPage')
const UsersPage = lazyPage('UsersPage')

function getLinkedResultId() {
  const match = window.location.pathname.match(/^\/results\/([^/]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

function AppContent() {
  const { user, token, isAuthenticated, isLoading, logout } = useAuth()
  const [currentView, setCurrentView] = useState<ViewKey>('dashboard')
  // Captured once at mount, not re-read from the URL on every render: this app
  // switches views via state, not a real router, so window.location.pathname
  // never changes on in-app navigation. Re-deriving this live would keep
  // matching the original /results/:id path forever and trap the user there.
  const [linkedResultId] = useState(getLinkedResultId)
  // `user` gets a new object reference whenever AuthContext refreshes it
  // (the background /auth/me call right after mount, a password change,
  // etc). Without this guard, each of those refreshes re-runs the effect
  // below and snaps the user back to Gap Results even after they've
  // navigated elsewhere — this ref makes the redirect fire at most once.
  const appliedLinkedResultRef = useRef(false)

  useEffect(() => {
    if (appliedLinkedResultRef.current) return
    if (isAuthenticated && user && linkedResultId) {
      appliedLinkedResultRef.current = true
      setCurrentView('results')
      // Clear the deep-link path now that it's been applied, so later
      // navigation away from Gap Results isn't immediately reverted.
      window.history.replaceState(null, '', '/')
    }
  }, [isAuthenticated, user, linkedResultId])

  useEffect(() => {
    if (user && !canAccessView(user.role, currentView)) {
      setCurrentView('dashboard')
    }
  }, [currentView, user])

  if (isLoading) {
    return <div className="boot-screen">Loading application...</div>
  }

  if (!isAuthenticated || !user || !token) {
    return <AuthPages />
  }

  if (user.mustChangePassword) {
    return (
      <AppLayout
        currentView="dashboard"
        onLogout={logout}
        onNavigate={setCurrentView}
        user={user}
      >
        <ForcePasswordChangePage />
      </AppLayout>
    )
  }

  function renderPage() {
    if (!user || !token) return null

    if (!canAccessView(user.role, currentView)) {
      return <DashboardPage onNavigate={setCurrentView} role={user.role} token={token} />
    }

    if (currentView === 'dashboard') {
      return <DashboardPage onNavigate={setCurrentView} role={user.role} token={token} />
    }

    if (currentView === 'profile') {
      return <GraduateProfilePage token={token} />
    }

    if (currentView === 'submit') {
      return <SubmitAssessmentPage token={token} />
    }

    if (currentView === 'assessments') {
      return <AssessmentsPage role={user.role} token={token} />
    }

    if (currentView === 'results') {
      return <GapResultsPage linkedResultId={linkedResultId} token={token} />
    }

    if (currentView === 'recommendations') {
      return <RecommendationsPage token={token} />
    }

    if (currentView === 'reports') {
      if (!isLearnerRole(user.role)) {
        return <DashboardPage onNavigate={setCurrentView} role={user.role} token={token} />
      }

      return <ReportsPage role={user.role} token={token} />
    }

    if (currentView === 'notifications') {
      return <NotificationsPage role={user.role} token={token} />
    }

    if (currentView === 'users') {
      return <UsersPage role={user.role} token={token} />
    }

    if (currentView === 'organizations') {
      return <OrganizationsPage token={token} />
    }

    if (currentView === 'competencies') {
      return <CompetenciesPage token={token} />
    }

    if (currentView === 'checklists') {
      return <RepositoryChecklistsPage token={token} />
    }

    if (currentView === 'benchmarks') {
      return <BenchmarksPage token={token} />
    }

    if (currentView === 'legal-policies') {
      return <LegalPoliciesPage token={token} />
    }

    return <DashboardPage onNavigate={setCurrentView} role={user.role} token={token} />
  }

  return (
    <AppLayout
      currentView={currentView}
      onLogout={logout}
      onNavigate={setCurrentView}
      user={user}
    >
      <ErrorBoundary
        key={currentView}
        onReset={() => setCurrentView('dashboard')}
        resetLabel="Back to dashboard"
      >
        <Suspense fallback={<LoadingState message="Loading page..." />}>
          {renderPage()}
        </Suspense>
      </ErrorBoundary>
    </AppLayout>
  )
}

function ForcePasswordChangePage() {
  const { changePassword, logout } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const passwordPolicy = getPasswordPolicy(newPassword)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!passwordPolicy.isValid) {
      setError(passwordPolicyMessage('New password'))
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      setMessage('Password changed successfully. Your dashboard is ready.')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to change password')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="page-stack">
      <Card title="Change temporary password">
        <Alert type="info">
          Your account was created with a temporary password. Create a personal
          password before using the dashboard.
        </Alert>
        {error && <Alert type="error">{error}</Alert>}
        {message && <Alert type="success">{message}</Alert>}
        <form className="form-stack" onSubmit={handleSubmit}>
          <TextField
            label="Current temporary password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
          <TextField
            label="New password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          <div className={`password-strength password-strength--${newPassword.trim().length > 0 ? passwordPolicy.strength.toLowerCase() : 'empty'}`} aria-live="polite">
            <div className="password-strength__header">
              <span>Password strength</span>
              <strong>{newPassword.trim().length > 0 ? passwordPolicy.strength : 'Not started'}</strong>
            </div>
            <div className="password-strength__bar" aria-hidden="true">
              <span />
            </div>
            <ul>
              {passwordPolicy.requirements.map((requirement) => (
                <li key={requirement.key} className={requirement.passed ? 'is-met' : ''}>
                  {requirement.label}
                </li>
              ))}
            </ul>
          </div>
          <TextField
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
          <div className="form-actions">
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Changing password...' : 'Change password'}
            </Button>
            <Button variant="secondary" onClick={logout}>
              Logout
            </Button>
          </div>
        </form>
      </Card>
    </section>
  )
}

function App() {
  return (
    <ErrorBoundary onReset={() => window.location.reload()} resetLabel="Reload app">
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App

