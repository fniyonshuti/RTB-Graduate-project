import {
  getGraduateProfileByUserId,
  getProfileByGraduateId,
  listGraduateProfiles as listGraduateProfilesService,
  deleteGraduateProfileByUserId,
  deleteProfileByGraduateId,
  upsertProfileByGraduateId,
} from '../services/graduateService.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await getProfileByGraduateId(req.user._id);
  sendSuccess(res, 'Graduate profile loaded', profile);
});

export const upsertMyProfile = asyncHandler(async (req, res) => {
  const profile = await upsertProfileByGraduateId(req.user._id, req.body);
  sendSuccess(res, 'Graduate profile saved', profile);
});

export const listGraduateProfiles = asyncHandler(async (req, res) => {
  const profiles = await listGraduateProfilesService();
  sendSuccess(res, 'Graduate profiles loaded', profiles);
});

export const getGraduateProfile = asyncHandler(async (req, res) => {
  const profile = await getGraduateProfileByUserId(req.params.userId);
  sendSuccess(res, 'Graduate profile loaded', profile);
});

export const deleteMyProfile = asyncHandler(async (req, res) => {
  const profile = await deleteProfileByGraduateId(req.user._id);
  sendSuccess(res, 'Graduate profile deleted', profile);
});

export const deleteGraduateProfile = asyncHandler(async (req, res) => {
  const profile = await deleteGraduateProfileByUserId(req.params.userId);
  sendSuccess(res, 'Graduate profile deleted', profile);
});
