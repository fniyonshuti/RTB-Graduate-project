import mongoose from "mongoose";


const learningResourceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["video", "course", "documentation", "practice", "article", "tool", "other"],
      default: "other",
    },
    title: {
      type: String,
      trim: true,
    },
    provider: {
      type: String,
      trim: true,
    },
    url: {
      type: String,
      trim: true,
    },
    searchQuery: {
      type: String,
      trim: true,
    },
    skillArea: {
      type: String,
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const recommendationSchema = new mongoose.Schema(
  {
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
    },
    graduate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    competency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Competency",
      required: true,
    },
    assessor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    gapLevel: {
      type: String,
      enum: ["No Gap", "Very Low Gap", "Low Gap", "Moderate Gap", "High Gap"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    draftMessage: {
      type: String,
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
    learningResources: {
      type: [learningResourceSchema],
      default: [],
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "low",
    },
    aiProvider: {
      type: String,
      trim: true,
    },
    aiModel: {
      type: String,
      trim: true,
    },
    aiPrompt: {
      type: String,
      trim: true,
    },
    aiRawResponse: {
      type: String,
      trim: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

recommendationSchema.index({ graduate: 1, competency: 1 });
recommendationSchema.index({ assessment: 1 });

export default mongoose.model("Recommendation", recommendationSchema);
