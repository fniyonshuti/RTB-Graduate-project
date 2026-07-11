import mongoose from 'mongoose';

const automatedTestFileSchema = new mongoose.Schema(
  {
    path: {
      type: String,
      trim: true,
    },
    content: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);


const practicalTestCaseSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      trim: true,
    },
    requirementId: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    input: {
      type: String,
      default: '',
    },
    expectedOutput: {
      type: String,
      default: '',
    },
    validator: {
      type: String,
      enum: ['exact_text', 'normalized_text', 'json', 'numeric'],
      default: 'normalized_text',
    },
    tolerance: {
      type: Number,
      min: 0,
      default: 0,
    },
    weight: {
      type: Number,
      min: 1,
      default: 10,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);


const practicalTaskChecklistItemSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ['frontend', 'backend', 'database', 'authentication', 'testing', 'documentation', 'deployment', 'security', 'general'],
      default: 'general',
    },
    validationType: {
      type: String,
      enum: ['automated_test', 'hidden_test', 'eslint', 'security_scan', 'repository_scan', 'implementation_review', 'manual_review'],
      default: 'implementation_review',
    },
    maxScore: {
      type: Number,
      min: 1,
      max: 100,
      default: 10,
    },
    weight: {
      type: Number,
      min: 1,
      max: 100,
      default: 10,
    },
    successThreshold: {
      type: Number,
      min: 0,
      max: 100,
      default: 70,
    },
    feedbackWhenFailed: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);
const practicalTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    instructions: {
      type: String,
      required: true,
      trim: true,
    },
    deliverables: {
      type: String,
      trim: true,
    },
    estimatedMinutes: {
      type: Number,
      min: 1,
      default: 60,
    },
    maxScore: {
      type: Number,
      min: 1,
      max: 100,
      default: 100,
    },
    automatedTestCommand: {
      type: String,
      trim: true,
    },
    automatedTestFiles: {
      type: [automatedTestFileSchema],
      default: [],
    },
    taskVersion: {
      type: String,
      trim: true,
      default: '1.0.0',
    },
    acceptedSubmissionTypes: {
      type: [String],
      default: ['github_repository'],
    },
    allowedLanguages: {
      type: [String],
      default: ['javascript', 'typescript', 'python'],
    },
    executionInterface: {
      type: String,
      enum: ['stdin_stdout', 'rest_api', 'cli', 'frontend', 'instructor_tests'],
      default: 'instructor_tests',
    },
    inputSchema: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    outputSchema: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    validationRules: {
      type: [String],
      default: [],
    },
    publicTestCases: {
      type: [practicalTestCaseSchema],
      default: [],
    },
    hiddenTestCases: {
      type: [practicalTestCaseSchema],
      default: [],
    },
    edgeCases: {
      type: [String],
      default: [],
    },
    timeLimitMs: {
      type: Number,
      min: 1000,
      default: 10000,
    },
    memoryLimitMb: {
      type: Number,
      min: 64,
      default: 512,
    },
    networkPolicy: {
      type: String,
      enum: ['disabled', 'install_only', 'enabled'],
      default: 'install_only',
    },
    requiredApiRoutes: {
      type: [String],
      default: [],
    },
    correctnessWeight: {
      type: Number,
      min: 0,
      max: 100,
      default: 75,
    },
    codeQualityWeight: {
      type: Number,
      min: 0,
      max: 100,
      default: 10,
    },
    performanceWeight: {
      type: Number,
      min: 0,
      max: 100,
      default: 5,
    },
    securityWeight: {
      type: Number,
      min: 0,
      max: 100,
      default: 10,
    },
    securityRules: {
      type: [String],
      default: [],
    },
    partialCreditRules: {
      type: [String],
      default: [],
    },
  },
  { timestamps: false }
);

const theoryQuestionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['multiple_choice', 'short_answer'],
      default: 'short_answer',
    },
    options: [
      {
        type: String,
        trim: true,
      },
    ],
    correctAnswer: {
      type: String,
      trim: true,
    },
    expectedAnswer: {
      type: String,
      trim: true,
    },
    points: {
      type: Number,
      min: 1,
      default: 1,
    },
  },
  { timestamps: false }
);

const competencySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    expectedEvidence: {
      type: String,
      trim: true,
    },
    practicalTasks: {
      type: [practicalTaskSchema],
      default: [],
    },
    theoryQuestions: {
      type: [theoryQuestionSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

competencySchema.index({ category: 1, isActive: 1 });

export default mongoose.model('Competency', competencySchema);
