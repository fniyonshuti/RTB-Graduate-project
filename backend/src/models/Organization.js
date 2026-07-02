import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    district: {
      type: String,
      trim: true,
      default: 'Kicukiro',
    },
    type: {
      type: String,
      enum: ['tvet_institution', 'training_center', 'other'],
      default: 'tvet_institution',
    },
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true },
);

organizationSchema.index({ status: 1, name: 1 });

export default mongoose.model('Organization', organizationSchema);
