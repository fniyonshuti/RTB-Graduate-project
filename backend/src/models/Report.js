import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    graduate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    summary: {
      type: String,
      trim: true,
    },
    assessments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assessment',
      },
    ],
    overallScore: {
      type: Number,
      default: 0,
    },
    overallGapLevel: {
      type: String,
      enum: [
        'No Gap',
        'Very Low Gap',
        'Low Gap',
        'Moderate Gap',
        'High Gap',
        'Not Available',
      ],
      default: 'Not Available',
    },
    strengths: [
      {
        type: String,
        trim: true,
      },
    ],
    weaknesses: [
      {
        type: String,
        trim: true,
      },
    ],
    recommendations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recommendation',
      },
    ],
    repositoryAnalysisSummary: {
      type: String,
      trim: true,
    },
    rubricBreakdown: [
      {
        label: String,
        score: Number,
        explanation: String,
        confidence: String,
        commandEvidence: {
          command: String,
          exitCode: Number,
          output: String,
        },
      },
    ],
    finalConclusion: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

reportSchema.index({ graduate: 1, createdAt: -1 });
reportSchema.index({ organization: 1, createdAt: -1 });

export default mongoose.model('Report', reportSchema);
