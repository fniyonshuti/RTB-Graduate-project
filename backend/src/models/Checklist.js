import mongoose from "mongoose";

export const CHECKLIST_CATEGORIES = [
  "frontend",
  "backend",
  "database",
  "authentication",
  "testing",
  "documentation",
  "deployment",
  "security",
  "general",
];

export const CHECKLIST_VALIDATION_TYPES = [
  "automated_test",
  "hidden_test",
  "eslint",
  "security_scan",
  "repository_scan",
  "implementation_review",
  "manual_review",
];

export const checklistItemSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: CHECKLIST_CATEGORIES,
      default: "general",
    },
    validationType: {
      type: String,
      enum: CHECKLIST_VALIDATION_TYPES,
      default: "implementation_review",
    },
    maxScore: {
      type: Number,
      min: 1,
      max: 100,
      default: 10,
    },
    weight: {
      type: Number,
      min: 1,
      max: 100,
      default: 10,
    },
    successThreshold: {
      type: Number,
      min: 0,
      max: 100,
      default: 70,
    },
    feedbackWhenFailed: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const checklistSchema = new mongoose.Schema(
  {
    competency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Competency",
      required: true,
    },
    practicalTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    items: {
      type: [checklistItemSchema],
      validate: {
        validator(items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: "At least one checklist item is required.",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

checklistSchema.index({ competency: 1, practicalTaskId: 1, isActive: 1 });

export default mongoose.model("Checklist", checklistSchema);
