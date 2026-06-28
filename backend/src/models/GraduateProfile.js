import mongoose from 'mongoose';

const graduateProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    registrationNumber: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say', ''],
      default: '',
    },
    district: {
      type: String,
      default: 'Kicukiro',
      trim: true,
    },
    sector: {
      type: String,
      trim: true,
    },
    institution: {
      type: String,
      trim: true,
    },
    program: {
      type: String,
      trim: true,
    },
    graduationYear: {
      type: Number,
    },
    specialization: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

graduateProfileSchema.index({ institution: 1, program: 1 });

export default mongoose.model('GraduateProfile', graduateProfileSchema);
