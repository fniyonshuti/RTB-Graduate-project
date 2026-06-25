import GraduateProfile from '../models/GraduateProfile.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await GraduateProfile.findOne({ user: req.user._id }).populate(
    'user',
    'name email institution role'
  );

  sendSuccess(res, 'Graduate profile loaded', profile);
});

export const upsertMyProfile = asyncHandler(async (req, res) => {
  const profile = await GraduateProfile.findOneAndUpdate(
    { user: req.user._id },
    { ...req.body, user: req.user._id },
    { new: true, upsert: true, runValidators: true }
  ).populate('user', 'name email institution role');

  sendSuccess(res, 'Graduate profile saved', profile);
});

export const listGraduateProfiles = asyncHandler(async (req, res) => {
  const profiles = await GraduateProfile.find()
    .populate('user', 'name email institution role isActive')
    .sort({ createdAt: -1 });

  sendSuccess(res, 'Graduate profiles loaded', profiles);
});

export const getGraduateProfile = asyncHandler(async (req, res) => {
  const profile = await GraduateProfile.findOne({ user: req.params.userId }).populate(
    'user',
    'name email institution role isActive'
  );

  if (!profile) {
    throw new AppError('Graduate profile was not found', 404);
  }

  sendSuccess(res, 'Graduate profile loaded', profile);
});
