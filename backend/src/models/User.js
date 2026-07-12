import mongoose from 'mongoose';
import { USER_ROLE_VALUES, ROLES } from '../constants/roles.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    passwordSalt: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLE_VALUES,
      default: ROLES.NORMAL_USER,
    },
    googleId: {
      type: String,
      trim: true,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
    },
    institution: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    passwordChangedAt: {
      type: Date,
    },
    temporaryPasswordExpiresAt: {
      type: Date,
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
    },
    passwordResetExpiresAt: {
      type: Date,
      select: false,
    },
    passwordResetUsedAt: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ organization: 1, role: 1, isActive: 1 });
userSchema.index({ passwordResetTokenHash: 1 });

export default mongoose.model('User', userSchema);
