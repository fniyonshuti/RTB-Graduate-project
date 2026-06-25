import mongoose from 'mongoose';

const recommendationSchema = new mongoose.Schema(
  {
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
    },
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
    gapLevel: {
      type: String,
      enum: ['No Gap', 'Low Gap', 'Moderate Gap', 'High Gap'],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    actionItems: [
      {
        type: String,
        trim: true,
      },
    ],
    resources: [
      {
        type: String,
        trim: true,
      },
    ],
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },
  },
  { timestamps: true }
);

recommendationSchema.index({ graduate: 1, competency: 1 });
recommendationSchema.index({ assessment: 1 });

export default mongoose.model('Recommendation', recommendationSchema);
