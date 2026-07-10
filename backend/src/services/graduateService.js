import GraduateProfile from "../models/GraduateProfile.js";
import { AppError } from "./errorService.js";
import { ROLES } from "../constants/roles.js";

const PROFILE_USER_FIELDS = "name email institution role";
const PROFILE_ADMIN_USER_FIELDS = "name email institution role isActive organization";

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

function organizationIdOf(user) {
  return user?.organization?._id || user?.organization;
}

function assertProfileInOrganization(profile, actor) {
  if (
    actor.role === ROLES.ORGANIZATION_ADMIN &&
    String(profile.user?.organization || "") !== String(organizationIdOf(actor) || "")
  ) {
    throw new AppError("You can only access profiles for your organization", 403);
  }
}

export async function listGraduateProfiles(actor) {
  const profiles = await GraduateProfile.find()
    .populate("user", PROFILE_ADMIN_USER_FIELDS)
    .sort({ createdAt: -1 });

  if (actor.role !== ROLES.ORGANIZATION_ADMIN) return profiles;

  return profiles.filter(
    (profile) =>
      String(profile.user?.organization || "") === String(organizationIdOf(actor) || ""),
  );
}

export async function getGraduateProfileByUserId(userId, actor) {
  const profile = await GraduateProfile.findOne({ user: userId }).populate(
    "user",
    `${PROFILE_ADMIN_USER_FIELDS} organization`,
  );

  if (!profile) {
    throw new AppError("Graduate profile was not found", 404);
  }

  assertProfileInOrganization(profile, actor);

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

class GraduateService {
  getProfileByGraduateId = getProfileByGraduateId;
  upsertProfileByGraduateId = upsertProfileByGraduateId;
  listGraduateProfiles = listGraduateProfiles;
  getGraduateProfileByUserId = getGraduateProfileByUserId;
  deleteProfileByGraduateId = deleteProfileByGraduateId;
  deleteGraduateProfileByUserId = deleteGraduateProfileByUserId;
}

const graduateService = new GraduateService();

export default graduateService;
