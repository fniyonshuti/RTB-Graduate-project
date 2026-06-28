import mongoose from 'mongoose';

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

const portfolioRequirementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    required: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: false }
);

const rubricCriteriaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    weight: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    maxScore: {
      type: Number,
      min: 1,
      max: 100,
      default: 100,
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
    portfolioRequirements: {
      type: [portfolioRequirementSchema],
      default: [],
    },
    rubricCriteria: {
      type: [rubricCriteriaSchema],
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
