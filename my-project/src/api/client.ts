import type {
  ApiResponse,
  Assessment,
  AuthPayload,
  Benchmark,
  Competency,
  DashboardData,
  GraduateProfile,
  NotificationItem,
  Organization,
  Recommendation,
  LearningResource,
  RepositoryAssessmentResult,
  Report,
  RepositoryChecklist,
  RepositorySummary,
  RepositoryTaskReview,
  Role,
  User,
} from '../types'

function normalizeApiUrl(value: string) {
  const cleanedUrl = value.trim().replace(/\/+$/, '')
  if (!cleanedUrl) return ''
  return cleanedUrl.endsWith('/api') ? cleanedUrl : `${cleanedUrl}/api`
}

const configuredApiUrl = normalizeApiUrl(String(import.meta.env.VITE_API_URL || ''))

function currentFrontendOrigin() {
  if (typeof window === 'undefined') return 'this frontend domain'
  return window.location.origin
}

function apiBaseUrl() {
  if (!configuredApiUrl) {
    throw new Error('Backend API is not configured.')
  }

  return configuredApiUrl
}

function cleanMessage(message: string) {
  return message.replace(/\s+/g, ' ').replace(/\.+$/, '').trim()
}

function buildConnectionErrorMessage() {
  return import.meta.env.PROD
    ? 'Cannot connect to the server. Please try again shortly.'
    : 'Cannot connect to the local backend. Start the backend and refresh.'
}

function logApiProblem(
  path: string,
  context: {
    baseUrl: string
    details?: string[]
    payload?: ApiResponse<unknown>
    response?: Response
  },
) {
  console.error('API request failed', {
    path,
    baseUrl: context.baseUrl,
    frontendOrigin: currentFrontendOrigin(),
    status: context.response?.status,
    requestId: context.payload?.requestId,
    backendMessage: context.payload?.message,
    details: context.details,
  })
}

function buildHttpErrorMessage(path: string, response: Response, payload: ApiResponse<unknown>) {
  const message = cleanMessage(payload.message || response.statusText || 'Request failed')

  if (response.status === 401) {
    return /invalid email or password/i.test(message)
      ? 'Invalid email or password.'
      : 'Your session has expired. Please sign in again.'
  }

  if (response.status === 403) {
    if (/verify your email address/i.test(message)) return message
    return 'You do not have permission to perform this action.'
  }

  if (response.status === 404 && path.startsWith('/checklists')) {
    return 'Repository checklist is not available yet. Please refresh after backend deployment.'
  }

  if (response.status === 404) {
    return 'The requested information was not found.'
  }

  if (response.status === 409) {
    return `${message}.`
  }

  if (response.status === 429) {
    return `${message}.`
  }

  if (path === '/auth/google' && response.status >= 500) {
    return 'Google sign-in is temporarily unavailable. Please try again shortly.'
  }

  if (response.status === 503) {
    return 'Service is temporarily unavailable. Please try again shortly.'
  }

  if (response.status >= 500) {
    return 'Something went wrong. Please try again shortly.'
  }

  return `${message}.`
}
export type RegisterResponse = {
  user: User
  token?: string
  verificationRequired?: boolean
  emailSent?: boolean
  message?: string
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string | null
}

async function request<T>(path: string, options: RequestOptions = {}) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  let response: Response | null = null
  const connectionErrors: string[] = []

  const baseUrl = apiBaseUrl()

  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch (error) {
    connectionErrors.push(
      `${baseUrl}: ${error instanceof Error ? error.message : 'network error'}`,
    )
  }

  if (!response) {
    logApiProblem(path, { baseUrl, details: connectionErrors })
    throw new Error(buildConnectionErrorMessage())
  }

  let payload: ApiResponse<T>

  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch (error) {
    logApiProblem(path, {
      baseUrl,
      details: [error instanceof Error ? error.message : 'Invalid JSON response'],
      response,
    })
    throw new Error('The server returned an unexpected response. Please try again.')
  }

  if (!response.ok) {
    logApiProblem(path, { baseUrl, payload, response })
    throw new Error(buildHttpErrorMessage(path, response, payload))
  }

  return payload.data
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthPayload>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  googleLogin: (credential: string) =>
    request<AuthPayload>('/auth/google', {
      method: 'POST',
      body: { credential },
    }),
  forgotPassword: (email: string) =>
    request<{
      message: string
      resetLink?: string
      expiresInMinutes?: number
      emailSent?: boolean
      emailStatus?: string
      emailMessage?: string
    }>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    }),

  resetPassword: (token: string, newPassword: string) =>
    request<User>('/auth/reset-password', {
      method: 'POST',
      body: { token, newPassword },
    }),

  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<User>('/auth/change-password', {
      method: 'PATCH',
      token,
      body: { currentPassword, newPassword },
    }),

  register: (body: {
    name: string
    email: string
    password: string
    institution?: string
  }) => request<RegisterResponse>('/auth/register', { method: 'POST', body }),

  verifyEmail: (token: string) =>
    request<{ user: User; message: string }>('/auth/verify-email', {
      method: 'POST',
      body: { token },
    }),

  resendVerificationEmail: (email: string) =>
    request<{ message: string; emailSent?: boolean }>('/auth/resend-verification', {
      method: 'POST',
      body: { email },
    }),

  me: (token: string) => request<User>('/auth/me', { token }),

  publicOrganizations: () =>
    request<Organization[]>('/organizations/public'),

  dashboard: (token: string) => request<DashboardData>('/dashboard', { token }),

  competencies: (token: string) =>
    request<Competency[]>('/competencies?activeOnly=true', { token }),

  competency: (token: string, id: string) =>
    request<Competency>(`/competencies/${id}`, { token }),

  createCompetency: (token: string, body: Record<string, unknown>) =>
    request<Competency>('/competencies', { method: 'POST', token, body }),

  updateCompetency: (token: string, id: string, body: Record<string, unknown>) =>
    request<Competency>(`/competencies/${id}`, { method: 'PUT', token, body }),

  deleteCompetency: (token: string, id: string) =>
    request<Competency>(`/competencies/${id}`, { method: 'DELETE', token }),

  checklists: (token: string) =>
    request<RepositoryChecklist[]>('/checklists?activeOnly=false', { token }),

  createChecklist: (
    token: string,
    body: {
      competency: string
      practicalTaskId: string
      title?: string
      items: Record<string, unknown>[]
    },
  ) => request<RepositoryChecklist>('/checklists', { method: 'POST', token, body }),

  updateChecklist: (
    token: string,
    id: string,
    body: Partial<{
      competency: string
      practicalTaskId: string
      title: string
      items: Record<string, unknown>[]
      isActive: boolean
    }>,
  ) => request<RepositoryChecklist>(`/checklists/${id}`, { method: 'PUT', token, body }),

  deleteChecklist: (token: string, id: string) =>
    request<RepositoryChecklist>(`/checklists/${id}`, { method: 'DELETE', token }),

  benchmarks: (token: string) =>
    request<Benchmark[]>('/benchmarks?activeOnly=true', { token }),

  benchmark: (token: string, id: string) =>
    request<Benchmark>(`/benchmarks/${id}`, { token }),

  createBenchmark: (
    token: string,
    body: { competency: string; requiredScore: number; level: string; description?: string },
  ) => request<Benchmark>('/benchmarks', { method: 'POST', token, body }),

  updateBenchmark: (
    token: string,
    id: string,
    body: Partial<{ competency: string; requiredScore: number; level: string; description: string; isActive: boolean }>,
  ) => request<Benchmark>(`/benchmarks/${id}`, { method: 'PUT', token, body }),

  deleteBenchmark: (token: string, id: string) =>
    request<Benchmark>(`/benchmarks/${id}`, { method: 'DELETE', token }),

  profile: (token: string) => request<GraduateProfile | null>('/graduates/me', { token }),

  saveProfile: (token: string, body: GraduateProfile) =>
    request<GraduateProfile>('/graduates/me', { method: 'PUT', token, body }),

  deleteProfile: (token: string) =>
    request<GraduateProfile>('/graduates/me', { method: 'DELETE', token }),

  assessments: (token: string) => request<Assessment[]>('/assessments', { token }),

  assessment: (token: string, id: string) =>
    request<Assessment>(`/assessments/${id}`, { token }),

  submitAssessment: (
    token: string,
    body: {
      competency: string
      practicalSubmissionMode?: 'direct_test' | 'file_upload' | 'mixed'
      practicalTaskId?: string
      practicalTask?: string
      githubRepositoryUrl?: string
      quizAnswers?: string
      theoryAnswers?: {
        questionId: string
        answer: string
      }[]
      fileUrls?: string[]
      evidenceFiles?: {
        name: string
        type?: string
        size?: number
        dataUrl: string
      }[]
      repositoryTaskReview?: RepositoryTaskReview
    },
  ) => request<Assessment>('/assessments', { method: 'POST', token, body }),

  updateAssessment: (token: string, id: string, body: Partial<Assessment>) =>
    request<Assessment>(`/assessments/${id}`, { method: 'PUT', token, body }),

  deleteAssessment: (token: string, id: string) =>
    request<Assessment>(`/assessments/${id}`, { method: 'DELETE', token }),

  reviewRepositoryTask: (
    token: string,
    body: {
      competency: string
      practicalTaskId?: string
      githubRepositoryUrl: string
    },
  ) =>
    request<{
      repositorySummary: RepositorySummary
      taskReview: RepositoryTaskReview
    }>('/assessments/repository-task-review', {
      method: 'POST',
      token,
      body,
    }),

  assessRepository: (
    token: string,
    body: {
      repositoryUrl: string
      competency?: string
      practicalTaskId?: string
    },
  ) =>
    request<RepositoryAssessmentResult>('/repository-assessments', {
      method: 'POST',
      token,
      body,
    }),

  repositoryAssessmentResults: (token: string) =>
    request<RepositoryAssessmentResult[]>('/repository-assessments', { token }),

  repositoryAssessmentResult: (token: string, id: string) =>
    request<RepositoryAssessmentResult>(`/repository-assessments/${id}`, { token }),

  updateRepositoryAssessmentResult: (
    token: string,
    id: string,
    body: Partial<RepositoryAssessmentResult>,
  ) =>
    request<RepositoryAssessmentResult>(`/repository-assessments/${id}`, {
      method: 'PUT',
      token,
      body,
    }),

  deleteRepositoryAssessmentResult: (token: string, id: string) =>
    request<RepositoryAssessmentResult>(`/repository-assessments/${id}`, {
      method: 'DELETE',
      token,
    }),

  reviewAssessment: (
    token: string,
    id: string,
    body: {
      practicalTaskScore: number
      quizScore: number
      assessorComment?: string
      evidenceVerification?: {
        githubReviewed?: boolean
        practicalEvidenceReviewed?: boolean
        theoryReviewed?: boolean
        authenticityNotes?: string
      }
      recommendation?: {
        message?: string
        actionItems?: string[]
        resources?: string[]
        learningResources?: LearningResource[]
        geminiDraft?: {
          message: string
          actionItems: string[]
          resources: string[]
          learningResources?: LearningResource[]
          priority: 'low' | 'medium' | 'high'
          provider: string
          model: string
          prompt?: string
          rawResponse?: string
        }
      }
    },
  ) => request<{ assessment: Assessment; recommendation: Recommendation }>(
    `/assessments/${id}/review`,
    { method: 'PUT', token, body },
  ),

  previewAssessmentRecommendation: (
    token: string,
    id: string,
    body: {
      practicalTaskScore: number
      quizScore: number
      assessorComment?: string
      evidenceVerification?: {
        githubReviewed?: boolean
        practicalEvidenceReviewed?: boolean
        theoryReviewed?: boolean
        authenticityNotes?: string
      }
    },
  ) => request<{
    assessmentId: string
    benchmarkScore: number
    finalScore: number
    skillGap: number
    gapLevel: string
    recommendation: {
      draftMessage: string
      message: string
      actionItems: string[]
      resources: string[]
      learningResources?: LearningResource[]
      priority: 'low' | 'medium' | 'high'
      provider: string
      model: string
      prompt?: string
      rawResponse?: string
    }
    context: Record<string, unknown>
  }>(`/assessments/${id}/recommendation-preview`, {
    method: 'POST',
    token,
    body,
  }),

  results: (token: string) => request<Assessment[]>('/assessments/results/me', { token }),

  recommendations: (token: string) =>
    request<Recommendation[]>('/recommendations', { token }),

  recommendation: (token: string, id: string) =>
    request<Recommendation>(`/recommendations/${id}`, { token }),

  updateRecommendation: (token: string, id: string, body: Partial<Recommendation>) =>
    request<Recommendation>(`/recommendations/${id}`, { method: 'PUT', token, body }),

  deleteRecommendation: (token: string, id: string) =>
    request<Recommendation>(`/recommendations/${id}`, { method: 'DELETE', token }),

  reports: (token: string) => request<Report[]>('/reports', { token }),

  report: (token: string, id: string) => request<Report>(`/reports/${id}`, { token }),

  generateReport: (token: string, graduateId?: string) =>
    request<Report>('/reports', {
      method: 'POST',
      token,
      body: graduateId ? { graduateId } : {},
    }),

  updateReport: (token: string, id: string, body: Partial<Report>) =>
    request<Report>(`/reports/${id}`, { method: 'PUT', token, body }),

  deleteReport: (token: string, id: string) =>
    request<Report>(`/reports/${id}`, { method: 'DELETE', token }),

  notifications: (token: string) =>
    request<NotificationItem[]>('/notifications', { token }),

  notification: (token: string, id: string) =>
    request<NotificationItem>(`/notifications/${id}`, { token }),

  allNotifications: (token: string) =>
    request<NotificationItem[]>('/notifications/manage', { token }),

  createNotification: (
    token: string,
    body: {
      title: string
      message: string
      type?: 'assessment' | 'recommendation' | 'report' | 'system'
      role?: Role | 'all'
      recipientId?: string
      link?: string
    },
  ) => request<NotificationItem[]>('/notifications', { method: 'POST', token, body }),

  updateNotification: (token: string, id: string, body: Partial<NotificationItem>) =>
    request<NotificationItem>(`/notifications/${id}`, { method: 'PUT', token, body }),

  deleteNotification: (token: string, id: string) =>
    request<NotificationItem>(`/notifications/${id}`, { method: 'DELETE', token }),

  markNotificationRead: (token: string, id: string) =>
    request<NotificationItem>(`/notifications/${id}/read`, {
      method: 'PATCH',
      token,
    }),

  markAllNotificationsRead: (token: string) =>
    request<{ modifiedCount: number }>('/notifications/read-all', {
      method: 'PATCH',
      token,
    }),

  users: (token: string) => request<User[]>('/users', { token }),

  user: (token: string, id: string) => request<User>(`/users/${id}`, { token }),

  createUser: (
    token: string,
    body: {
      name: string
      email: string
      password: string
      role: Role
      institution?: string
      organization?: string
      organizationId?: string
    },
  ) => request<User>('/users', { method: 'POST', token, body }),

  updateUser: (token: string, id: string, body: Partial<User>) =>
    request<User>(`/users/${id}`, { method: 'PUT', token, body }),

  deleteUser: (token: string, id: string) =>
    request<User>(`/users/${id}`, { method: 'DELETE', token }),

  organizations: (token: string) =>
    request<Organization[]>('/organizations', { token }),

  createOrganization: (
    token: string,
    body: {
      name: string
      district?: string
      type?: 'tvet_institution' | 'training_center' | 'other'
      contactEmail?: string
      phone?: string
      address?: string
      status?: 'active' | 'inactive'
    },
  ) => request<Organization>('/organizations', { method: 'POST', token, body }),

  updateOrganization: (
    token: string,
    id: string,
    body: Partial<Organization>,
  ) => request<Organization>(`/organizations/${id}`, { method: 'PUT', token, body }),

  deleteOrganization: (token: string, id: string) =>
    request<Organization>(`/organizations/${id}`, { method: 'DELETE', token }),
}

