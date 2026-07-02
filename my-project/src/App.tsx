import { useState } from 'react'
import './App.css'
import { Alert, Button, Card, TextField } from './components/common'
import { AppLayout, type ViewKey } from './components/layout'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import { AuthPages } from './pages/AuthPages'
import {
  AssessmentsPage,
  BenchmarksPage,
  CompetenciesPage,
  DashboardPage,
  GapResultsPage,
  GraduateProfilePage,
  NotificationsPage,
  OrganizationsPage,
  RecommendationsPage,
  ReportsPage,
  SubmitAssessmentPage,
  UsersPage,
} from './pages/MainPages'

function AppContent() {
  const { user, token, isAuthenticated, isLoading, logout } = useAuth()
  const [currentView, setCurrentView] = useState<ViewKey>('dashboard')

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
      return <GapResultsPage token={token} />
    }

    if (currentView === 'recommendations') {
      return <RecommendationsPage token={token} />
    }

    if (currentView === 'reports') {
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

    if (currentView === 'benchmarks') {
      return <BenchmarksPage token={token} />
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
      {renderPage()}
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
