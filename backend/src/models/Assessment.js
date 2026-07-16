import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema(
  {
    practicalSubmissionMode: {
      type: String,
      enum: ['direct_test', 'file_upload', 'mixed'],
      default: 'direct_test',
    },
    practicalTaskId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    practicalTaskTitle: {
      type: String,
      trim: true,
    },
    practicalTaskInstructions: {
      type: String,
      trim: true,
    },
    practicalTask: {
      type: String,
      trim: true,
    },
    githubRepositoryUrl: {
      type: String,
      trim: true,
    },
    repositorySummary: {
      url: String,
      owner: String,
      repo: String,
      isValid: Boolean,
      fetchStatus: String,
      analyzedAt: Date,
      description: String,
      defaultBranch: String,
      stars: Number,
      forks: Number,
      languages: [String],
      readmeFound: Boolean,
      readmeExcerpt: String,
      recentCommits: [
        {
          message: String,
          author: String,
          date: String,
        },
      ],
      supportedFileCount: Number,
      supportedFileTypes: [
        {
          extension: String,
          count: Number,
        },
      ],
      setupFileFound: Boolean,
      testFileFound: Boolean,
      packageScripts: mongoose.Schema.Types.Mixed,
      testScriptFound: Boolean,
      buildScriptFound: Boolean,
      ciWorkflowFound: Boolean,
      ciRunFound: Boolean,
      ciRunName: String,
      ciRunStatus: String,
      ciRunConclusion: String,
      ciRunUrl: String,
      ciRunUpdatedAt: String,
      ciPassing: Boolean,
      codeQualityScore: Number,
      evidenceCompletenessScore: Number,
      riskFlags: [String],
      taskReview: {
        taskId: mongoose.Schema.Types.ObjectId,
        taskTitle: String,
        score: Number,
        pointsEarned: Number,
        pointsPossible: Number,
        passedCount: Number,
        failedCount: Number,
        checklist: [
          {
            key: String,
            label: String,
            passed: Boolean,
            weight: Number,
            maxScore: Number,
            scoreAwarded: Number,
            weightedScore: Number,
            validationType: String,
            category: String,
            evidence: String,
            advice: String,
          },
        ],
        taskKeywords: [String],
        matchedTaskKeywords: [String],
        taskKeywordMatchRate: Number,
        implementationReview: {
          sourceFilesReviewed: Number,
          implementationKeywordMatches: [String],
          implementationKeywordRate: Number,
          expectedFunctionalAreas: [String],
          detectedFunctionalAreas: [String],
          missingFunctionalAreas: [String],
          functionalCoverageRate: Number,
          expectedActions: [String],
          matchedActions: [String],
          actionCoverageRate: Number,
          hasRuntimeIntegration: Number,
          implementationEvidenceScore: Number,
        },
        automatedProofSignals: Number,
        automatedProofPassed: Boolean,
        proofLevel: String,
        proofSummary: String,
        repositoryAssessmentResultId: mongoose.Schema.Types.ObjectId,
        repositoryAssessmentEvidence: mongoose.Schema.Types.Mixed,
        competencyScores: mongoose.Schema.Types.Mixed,
        recommendations: [String],
        feedback: [String],
        reviewedAt: Date,
        summary: String,
      },
      sampledSourceFiles: [
        {
          path: String,
          language: String,
          size: Number,
          excerpt: String,
        },
      ],
      topLevelItems: [String],
      codeQualityNotes: [String],
      summaryText: String,
    },
    quizAnswers: {
      type: String,
      trim: true,
    },
    theoryAnswers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
        },
        question: {
          type: String,
          trim: true,
        },
        answer: {
          type: String,
          trim: true,
        },
        correctAnswer: {
          type: String,
          trim: true,
          select: false,
        },
        isCorrect: {
          type: Boolean,
        },
        pointsAwarded: {
          type: Number,
          min: 0,
          default: 0,
        },
        pointsPossible: {
          type: Number,
          min: 0,
          default: 0,
        },
      },
    ],
    fileUrls: [
      {
        type: String,
        trim: true,
      },
    ],
    evidenceFiles: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        type: {
          type: String,
          trim: true,
        },
        size: {
          type: Number,
          min: 0,
        },
        dataUrl: {
          type: String,
          required: true,
        },
      },
    ],
  },
  { _id: false }
);

const scoresSchema = new mongoose.Schema(
  {
    practicalTaskScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    quizScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    finalScore: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  { _id: false }
);

const assessmentSchema = new mongoose.Schema(
  {
    graduate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
    },
    competency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Competency',
      required: true,
    },
    assessor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewMode: {
      type: String,
      enum: ['automatic', 'manual_legacy'],
      default: 'automatic',
    },
    reviewedBySystem: {
      type: Boolean,
      default: true,
    },
    scoringEngineVersion: {
      type: String,
      default: 'automatic-rubric-v1',
      trim: true,
    },
    evidence: {
      type: evidenceSchema,
      default: {},
    },
    scores: {
      type: scoresSchema,
      default: {},
    },
    benchmarkScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    skillGap: {
      type: Number,
      min: 0,
      default: 0,
    },
    gapLevel: {
      type: String,
      enum: [
        'No Gap',
        'Very Low Gap',
        'Low Gap',
        'Moderate Gap',
        'High Gap',
        'Not Reviewed',
      ],
      default: 'Not Reviewed',
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'under_review', 'reviewed', 'returned'],
      default: 'submitted',
    },
    assessorComment: {
      type: String,
      trim: true,
    },
    evidenceVerification: {
      githubReviewed: {
        type: Boolean,
        default: false,
      },
      practicalEvidenceReviewed: {
        type: Boolean,
        default: false,
      },
      theoryReviewed: {
        type: Boolean,
        default: false,
      },
      authenticityNotes: {
        type: String,
        trim: true,
      },
    },
    reviewedAt: {
      type: Date,
    },
    resultEmail: {
      sentAt: Date,
      provider: {
        type: String,
        trim: true,
      },
      messageId: {
        type: String,
        trim: true,
      },
      failedAt: Date,
      failureReason: {
        type: String,
        trim: true,
      },
    },
  },
  { timestamps: true }
);

assessmentSchema.index({ graduate: 1, competency: 1 });
assessmentSchema.index({ organization: 1, status: 1, createdAt: -1 });
assessmentSchema.index({ assessor: 1, status: 1 });
assessmentSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Assessment', assessmentSchema);

