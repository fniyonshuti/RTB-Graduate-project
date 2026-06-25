import { useEffect, useState } from 'react'
import './App.css'
import { AppLayout, getDefaultView, type ViewKey } from './components/layout'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AuthPages } from './pages/AuthPages'
import {
  AssessmentsPage,
  BenchmarksPage,
  CompetenciesPage,
  DashboardPage,
  GapResultsPage,
  GraduateProfilePage,
  NotificationsPage,
  RecommendationsPage,
  ReportsPage,
  SubmitAssessmentPage,
  UsersPage,
} from './pages/MainPages'

function AppContent() {
  const { user, token, isAuthenticated, isLoading, logout } = useAuth()
  const [currentView, setCurrentView] = useState<ViewKey>('dashboard')

  useEffect(() => {
    if (user) setCurrentView(getDefaultView(user.role))
  }, [user])

  if (isLoading) {
    return <div className="boot-screen">Loading application...</div>
  }

  if (!isAuthenticated || !user || !token) {
    return <AuthPages />
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
      return <UsersPage token={token} />
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

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
