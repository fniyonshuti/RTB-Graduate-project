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
    portfolioLink: {
      type: String,
      trim: true,
    },
    projectDescription: {
      type: String,
      trim: true,
    },
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
    selfAssessmentScore: {
      type: Number,
      min: 0,
      max: 100,
    },
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
    portfolioScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    selfAssessmentScore: {
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
    competency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Competency',
      required: true,
    },
    assessor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
      enum: ['No Gap', 'Low Gap', 'Moderate Gap', 'High Gap', 'Not Reviewed'],
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
    reviewedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

assessmentSchema.index({ graduate: 1, competency: 1 });
assessmentSchema.index({ assessor: 1, status: 1 });
assessmentSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Assessment', assessmentSchema);
