import type {
  ApiResponse,
  Assessment,
  AuthPayload,
  Benchmark,
  Competency,
  DashboardData,
  GraduateProfile,
  NotificationItem,
  Recommendation,
  Report,
  Role,
  User,
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const payload = (await response.json()) as ApiResponse<T>

  if (!response.ok) {
    throw new Error(payload.message || 'Request failed')
  }

  return payload.data
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthPayload>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  register: (body: {
    name: string
    email: string
    password: string
    role: Role
    institution?: string
  }) => request<AuthPayload>('/auth/register', { method: 'POST', body }),

  me: (token: string) => request<User>('/auth/me', { token }),

  dashboard: (token: string) => request<DashboardData>('/dashboard', { token }),

  competencies: (token: string) =>
    request<Competency[]>('/competencies?activeOnly=true', { token }),

  createCompetency: (token: string, body: Record<string, unknown>) =>
    request<Competency>('/competencies', { method: 'POST', token, body }),

  benchmarks: (token: string) =>
    request<Benchmark[]>('/benchmarks?activeOnly=true', { token }),

  createBenchmark: (
    token: string,
    body: { competency: string; requiredScore: number; level: string; description?: string },
  ) => request<Benchmark>('/benchmarks', { method: 'POST', token, body }),

  profile: (token: string) => request<GraduateProfile | null>('/graduates/me', { token }),

  saveProfile: (token: string, body: GraduateProfile) =>
    request<GraduateProfile>('/graduates/me', { method: 'PUT', token, body }),

  assessments: (token: string) => request<Assessment[]>('/assessments', { token }),

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
      portfolioLink?: string
      projectDescription?: string
      fileUrls?: string[]
      evidenceFiles?: {
        name: string
        type?: string
        size?: number
        dataUrl: string
      }[]
      selfAssessmentScore?: number
    },
  ) => request<Assessment>('/assessments', { method: 'POST', token, body }),

  reviewAssessment: (
    token: string,
    id: string,
    body: {
      practicalTaskScore: number
      quizScore: number
      portfolioScore: number
      selfAssessmentScore: number
      assessorComment?: string
      recommendation?: {
        message?: string
        actionItems?: string[]
        resources?: string[]
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
      portfolioScore: number
      selfAssessmentScore: number
      assessorComment?: string
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
      priority: 'low' | 'medium' | 'high'
      provider: string
      model: string
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

  reports: (token: string) => request<Report[]>('/reports', { token }),

  generateReport: (token: string, graduateId?: string) =>
    request<Report>('/reports', {
      method: 'POST',
      token,
      body: graduateId ? { graduateId } : {},
    }),

  notifications: (token: string) =>
    request<NotificationItem[]>('/notifications', { token }),

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
}
