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
