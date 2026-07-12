export type Role =
  | 'normal_user'
  | 'organization_user'
  | 'org_admin'
  | 'admin'
  | 'super_admin'
  | 'assessor'

export type Organization = {
  _id: string
  name: string
  district?: string
  type?: 'tvet_institution' | 'training_center' | 'other'
  contactEmail?: string
  phone?: string
  address?: string
  status?: 'active' | 'inactive'
}

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
  organization?: Organization | string
  institution?: string
  isActive?: boolean
  mustChangePassword?: boolean
  authProvider?: 'local' | 'google'
}

export type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
  requestId?: string
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
  isActive?: boolean
}

export type PracticalTaskChecklistItem = {
  key?: string
  title: string
  description?: string
  category?: 'frontend' | 'backend' | 'database' | 'authentication' | 'testing' | 'documentation' | 'deployment' | 'security' | 'general'
  validationType?: 'automated_test' | 'hidden_test' | 'eslint' | 'security_scan' | 'repository_scan' | 'implementation_review' | 'manual_review'
  maxScore?: number
  weight?: number
  successThreshold?: number
  feedbackWhenFailed?: string
}

export type PracticalTask = {
  _id: string
  title: string
  instructions: string
  deliverables?: string
  estimatedMinutes?: number
  maxScore?: number
  automatedTestCommand?: string
  automatedTestFiles?: {
    path?: string
    content?: string
  }[]
  reviewChecklist?: PracticalTaskChecklistItem[]
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
  reviewMode?: 'automatic' | 'manual_legacy'
  reviewedBySystem?: boolean
  scoringEngineVersion?: string
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
    fileUrls?: string[]
    evidenceFiles?: EvidenceFile[]
  }
  scores: {
    practicalTaskScore?: number
    quizScore?: number
    finalScore?: number
  }
  benchmarkScore?: number
  skillGap?: number
  gapLevel: GapLevel
  status: AssessmentStatus
  assessorComment?: string
  evidenceVerification?: {
    githubReviewed?: boolean
    practicalEvidenceReviewed?: boolean
    theoryReviewed?: boolean
    authenticityNotes?: string
  }
  createdAt?: string
  reviewedAt?: string
}

export type RepositoryTaskReview = {
  taskId?: string
  taskTitle?: string
  score: number
  pointsEarned: number
  pointsPossible: number
  passedCount: number
  failedCount: number
  checklist: {
    key: string
    label: string
    passed: boolean
    weight: number
    maxScore?: number
    scoreAwarded: number
    weightedScore: number
    validationType?: string
    category?: string
    evidence?: string
    advice?: string
  }[]
  taskKeywords?: string[]
  matchedTaskKeywords?: string[]
  taskKeywordMatchRate?: number
  implementationReview?: {
    sourceFilesReviewed?: number
    implementationKeywordMatches?: string[]
    implementationKeywordRate?: number
    expectedFunctionalAreas?: string[]
    detectedFunctionalAreas?: string[]
    missingFunctionalAreas?: string[]
    functionalCoverageRate?: number
    expectedActions?: string[]
    matchedActions?: string[]
    actionCoverageRate?: number
    hasRuntimeIntegration?: number
    implementationEvidenceScore?: number
  }
  automatedProofSignals?: number
  automatedProofPassed?: boolean
  proofLevel?: string
  proofSummary?: string
  repositoryAssessmentResultId?: string
  competencyScores?: Record<string, number>
  recommendations?: string[]
  feedback?: string[]
  reviewedAt?: string
  summary?: string
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
  setupFileFound?: boolean
  testFileFound?: boolean
  packageScripts?: Record<string, string>
  testScriptFound?: boolean
  buildScriptFound?: boolean
  ciWorkflowFound?: boolean
  ciRunFound?: boolean
  ciRunName?: string
  ciRunStatus?: string
  ciRunConclusion?: string
  ciRunUrl?: string
  ciRunUpdatedAt?: string
  ciPassing?: boolean
  codeQualityScore?: number
  evidenceCompletenessScore?: number
  riskFlags?: string[]
  taskReview?: RepositoryTaskReview
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

export type RepositoryAssessmentResult = {
  _id: string
  repositoryUrl: string
  owner?: string
  repo?: string
  verificationStatus: 'verified' | 'failed'
  executionMode: 'docker' | 'local' | 'static_only' | 'failed'
  projectType?: string
  detectedTechnologies: string[]
  totalTestCases: number
  passedTestCases: number
  accuracyScore: number
  gapClassification: 'Excellent' | 'Competent' | 'Moderate Gap' | 'High Gap' | string
  competencyScores: Record<
    'frontend' | 'backend' | 'database' | 'authentication' | 'testing' | 'documentation' | 'deployment',
    number
  >
  passedRequirements: {
    id?: string
    title?: string
    competency?: string
    passed?: boolean
    evidence?: string
    error?: string
  }[]
  failedRequirements: {
    id?: string
    title?: string
    competency?: string
    passed?: boolean
    evidence?: string
    error?: string
  }[]
  eslintResult?: {
    available?: boolean
    success?: boolean
    errors?: number
    warnings?: number
    output?: string
  }
  securityScanResult?: {
    available?: boolean
    success?: boolean
    high?: number
    critical?: number
    total?: number
    secretFindings?: string[]
    output?: string
  }
  assessorReviewStatus?: 'pending' | 'approved' | 'returned'
  automaticReviewStatus?: 'completed' | 'failed'
  commandResults?: {
    name?: string
    command?: string
    success?: boolean
    exitCode?: number
    stdout?: string
    stderr?: string
    durationMs?: number
  }[]
  recommendations: string[]
  assessorValidationRequired: boolean
  securityNotes: string[]
  errorMessage?: string
  createdAt?: string
}

export type LearningResource = {
  type: 'video' | 'course' | 'documentation' | 'practice' | 'article' | 'tool' | 'other'
  title: string
  provider?: string
  url?: string
  searchQuery?: string
  skillArea?: string
  reason?: string
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
  learningResources?: LearningResource[]
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
  repositoryAnalysisSummary?: string
  rubricBreakdown?: {
    label?: string
    score?: number
    explanation?: string
  }[]
  finalConclusion?: string
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
