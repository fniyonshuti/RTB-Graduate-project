import GraduateProfile from "../models/GraduateProfile.js";
import { AppError } from "../utils/errors.js";

const PROFILE_USER_FIELDS = "name email institution role";
const PROFILE_ADMIN_USER_FIELDS = "name email institution role isActive";

export function getProfileByGraduateId(graduateId) {
  return GraduateProfile.findOne({ user: graduateId }).populate(
    "user",
    PROFILE_USER_FIELDS,
  );
}

export function upsertProfileByGraduateId(graduateId, payload) {
  return GraduateProfile.findOneAndUpdate(
    { user: graduateId },
    { ...payload, user: graduateId },
    { new: true, upsert: true, runValidators: true },
  ).populate("user", PROFILE_USER_FIELDS);
}

export function listGraduateProfiles() {
  return GraduateProfile.find()
    .populate("user", PROFILE_ADMIN_USER_FIELDS)
    .sort({ createdAt: -1 });
}

export async function getGraduateProfileByUserId(userId) {
  const profile = await GraduateProfile.findOne({ user: userId }).populate(
    "user",
    PROFILE_ADMIN_USER_FIELDS,
  );

  if (!profile) {
    throw new AppError("Graduate profile was not found", 404);
  }

  return profile;
}

export async function deleteProfileByGraduateId(graduateId) {
  const profile = await GraduateProfile.findOneAndDelete({ user: graduateId });

  if (!profile) {
    throw new AppError("Graduate profile was not found", 404);
  }

  return profile;
}

export async function deleteGraduateProfileByUserId(userId) {
  const profile = await GraduateProfile.findOneAndDelete({ user: userId });

  if (!profile) {
    throw new AppError("Graduate profile was not found", 404);
  }

  return profile;
}
