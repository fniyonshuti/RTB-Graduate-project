export type Role = 'graduate' | 'assessor' | 'admin'

export type GapLevel =
  | 'No Gap'
  | 'Very Low Gap'
  | 'Low Gap'
  | 'Moderate Gap'
  | 'High Gap'
  | 'Not Reviewed'

export type AssessmentStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'reviewed'
  | 'returned'

export type User = {
  _id?: string
  id: string
  name: string
  email: string
  role: Role
  institution?: string
  isActive?: boolean
}

export type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export type AuthPayload = {
  user: User
  token: string
}

export type Competency = {
  _id: string
  title: string
  code: string
  category: string
  description?: string
  expectedEvidence?: string
  practicalTasks?: PracticalTask[]
  theoryQuestions?: TheoryQuestion[]
  portfolioRequirements?: PortfolioRequirement[]
  rubricCriteria?: RubricCriterion[]
  isActive?: boolean
}

export type PracticalTask = {
  _id: string
  title: string
  instructions: string
  deliverables?: string
  estimatedMinutes?: number
  maxScore?: number
}

export type TheoryQuestion = {
  _id: string
  question: string
  type: 'multiple_choice' | 'short_answer'
  options?: string[]
  correctAnswer?: string
  expectedAnswer?: string
  points: number
}

export type PortfolioRequirement = {
  _id: string
  title: string
  description: string
  required: boolean
}

export type RubricCriterion = {
  _id: string
  name: string
  description: string
  weight: number
  maxScore: number
}

export type Benchmark = {
  _id: string
  competency: Competency
  requiredScore: number
  level: 'basic' | 'intermediate' | 'advanced'
  description?: string
  isActive: boolean
}

export type GraduateProfile = {
  _id?: string
  registrationNumber?: string
  phone?: string
  gender?: string
  district?: string
  sector?: string
  institution?: string
  program?: string
  graduationYear?: number
  specialization?: string
  bio?: string
}

export type Assessment = {
  _id: string
  graduate: User
  assessor?: User
  competency: Competency
  evidence: {
    practicalSubmissionMode?: 'direct_test' | 'file_upload' | 'mixed'
    practicalTaskId?: string
    practicalTaskTitle?: string
    practicalTaskInstructions?: string
    practicalTask?: string
    githubRepositoryUrl?: string
    repositorySummary?: RepositorySummary
    quizAnswers?: string
    theoryAnswers?: {
      questionId: string
      question: string
      answer: string
      isCorrect?: boolean
      pointsAwarded: number
      pointsPossible: number
    }[]
    portfolioLink?: string
    projectDescription?: string
    fileUrls?: string[]
    evidenceFiles?: EvidenceFile[]
    selfAssessmentScore?: number
  }
  scores: {
    practicalTaskScore?: number
    quizScore?: number
    portfolioScore?: number
    selfAssessmentScore?: number
    finalScore?: number
  }
  benchmarkScore?: number
  skillGap?: number
  gapLevel: GapLevel
  status: AssessmentStatus
  assessorComment?: string
  createdAt?: string
  reviewedAt?: string
}

export type RepositorySummary = {
  url?: string
  owner?: string
  repo?: string
  isValid?: boolean
  fetchStatus?: string
  analyzedAt?: string
  description?: string
  defaultBranch?: string
  stars?: number
  forks?: number
  languages?: string[]
  readmeFound?: boolean
  readmeExcerpt?: string
  recentCommits?: {
    message?: string
    author?: string
    date?: string
  }[]
  supportedFileCount?: number
  supportedFileTypes?: {
    extension?: string
    count?: number
  }[]
  sampledSourceFiles?: {
    path?: string
    language?: string
    size?: number
    excerpt?: string
  }[]
  topLevelItems?: string[]
  codeQualityNotes?: string[]
  summaryText?: string
}

export type Recommendation = {
  _id: string
  graduate: User
  competency: Competency
  gapLevel: GapLevel
  message: string
  draftMessage?: string
  actionItems: string[]
  resources: string[]
  priority: 'low' | 'medium' | 'high'
  aiProvider?: string
  aiModel?: string
  aiPrompt?: string
  aiRawResponse?: string
  approvedBy?: User
  approvedAt?: string
  isApproved?: boolean
}

export type EvidenceFile = {
  name: string
  type?: string
  size?: number
  dataUrl: string
}

export type Report = {
  _id: string
  graduate?: User
  generatedBy?: User
  title: string
  summary?: string
  assessments?: Assessment[]
  overallScore: number
  overallGapLevel: GapLevel | 'Not Available'
  strengths: string[]
  weaknesses: string[]
  recommendations?: Recommendation[]
  createdAt?: string
}

export type NotificationItem = {
  _id: string
  recipient?: User
  title: string
  message: string
  type: 'assessment' | 'recommendation' | 'report' | 'system'
  isRead: boolean
  link?: string
  createdAt?: string
}

export type DashboardData = Record<string, unknown>
