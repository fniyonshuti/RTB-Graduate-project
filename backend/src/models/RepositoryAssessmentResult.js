import mongoose from 'mongoose';

const requirementSchema = new mongoose.Schema(
  {
    id: String,
    title: String,
    competency: String,
    passed: Boolean,
    evidence: String,
    error: String,
    weight: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false },
);

const commandResultSchema = new mongoose.Schema(
  {
    name: String,
    command: String,
    success: Boolean,
    exitCode: Number,
    stdout: String,
    stderr: String,
    durationMs: Number,
  },
  { _id: false },
);

const repositoryAssessmentResultSchema = new mongoose.Schema(
  {
    graduate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
    },
    competency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Competency',
    },
    practicalTaskId: mongoose.Schema.Types.ObjectId,
    repositoryUrl: {
      type: String,
      required: true,
      trim: true,
    },
    owner: String,
    repo: String,
    verificationStatus: {
      type: String,
      enum: ['verified', 'failed'],
      default: 'verified',
    },
    executionMode: {
      type: String,
      enum: ['docker', 'local', 'static_only', 'failed'],
      default: 'static_only',
    },
    projectType: String,
    detectedTechnologies: [String],
    submissionManifest: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    evaluatorResult: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    totalTestCases: {
      type: Number,
      min: 0,
      default: 0,
    },
    passedTestCases: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalWeight: {
      type: Number,
      min: 0,
      default: 0,
    },
    passedWeight: {
      type: Number,
      min: 0,
      default: 0,
    },
    accuracyScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    gapClassification: String,
    competencyScores: {
      frontend: { type: Number, default: 0 },
      backend: { type: Number, default: 0 },
      database: { type: Number, default: 0 },
      authentication: { type: Number, default: 0 },
      testing: { type: Number, default: 0 },
      documentation: { type: Number, default: 0 },
      deployment: { type: Number, default: 0 },
    },
    passedRequirements: [requirementSchema],
    failedRequirements: [requirementSchema],
    staticChecks: [requirementSchema],
    commandResults: [commandResultSchema],
    eslintResult: {
      available: Boolean,
      success: Boolean,
      errors: Number,
      warnings: Number,
      output: String,
    },
    securityScanResult: {
      available: Boolean,
      success: Boolean,
      high: Number,
      critical: Number,
      total: Number,
      secretFindings: [String],
      output: String,
    },
    assessorReviewStatus: {
      type: String,
      enum: ['pending', 'approved', 'returned'],
      default: 'pending',
    },
    automaticReviewStatus: {
      type: String,
      enum: ['completed', 'failed'],
      default: 'completed',
    },
    recommendations: [String],
    assessorValidationRequired: {
      type: Boolean,
      default: false,
    },
    securityNotes: [String],
    errorMessage: String,
  },
  { timestamps: true },
);

repositoryAssessmentResultSchema.index({ graduate: 1, createdAt: -1 });
repositoryAssessmentResultSchema.index({ organization: 1, createdAt: -1 });
repositoryAssessmentResultSchema.index({ competency: 1, createdAt: -1 });

export default mongoose.model(
  'RepositoryAssessmentResult',
  repositoryAssessmentResultSchema,
);
