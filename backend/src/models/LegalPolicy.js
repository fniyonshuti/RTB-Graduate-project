import mongoose from "mongoose";

const legalPolicySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["terms", "privacy"],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    documentFile: {
      name: { type: String, trim: true },
      type: { type: String, trim: true },
      size: { type: Number, min: 0 },
      dataUrl: { type: String },
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    publishedAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

legalPolicySchema.index({ type: 1, status: 1, isActive: 1 });
legalPolicySchema.index({ type: 1, version: 1 }, { unique: true });

export default mongoose.model("LegalPolicy", legalPolicySchema);
