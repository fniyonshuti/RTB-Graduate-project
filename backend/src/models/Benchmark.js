import mongoose from 'mongoose';

const benchmarkSchema = new mongoose.Schema(
  {
    competency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Competency',
      required: true,
    },
    requiredScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    level: {
      type: String,
      enum: ['basic', 'intermediate', 'advanced'],
      default: 'intermediate',
    },
    description: {
      type: String,
      trim: true,
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
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

benchmarkSchema.index({ competency: 1, isActive: 1 });

export default mongoose.model('Benchmark', benchmarkSchema);
