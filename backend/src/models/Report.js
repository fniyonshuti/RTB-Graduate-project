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
      enum: ['No Gap', 'Low Gap', 'Moderate Gap', 'High Gap', 'Not Available'],
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
  },
  { timestamps: true }
);

reportSchema.index({ graduate: 1, createdAt: -1 });

export default mongoose.model('Report', reportSchema);
