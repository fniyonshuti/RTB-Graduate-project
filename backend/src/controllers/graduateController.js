import graduateService from '../services/graduateService.js';
import { asyncHandler } from '../services/errorService.js';
import { sendSuccess } from '../services/responseService.js';

class GraduateController {
  getMyProfile = asyncHandler(async (req, res) => {
    const profile = await graduateService.getProfileByGraduateId(req.user._id);
    sendSuccess(res, 'Graduate profile loaded', profile);
  });

  upsertMyProfile = asyncHandler(async (req, res) => {
    const profile = await graduateService.upsertProfileByGraduateId(req.user._id, req.body);
    sendSuccess(res, 'Graduate profile saved', profile);
  });

  listGraduateProfiles = asyncHandler(async (req, res) => {
    const profiles = await graduateService.listGraduateProfiles(req.user);
    sendSuccess(res, 'Graduate profiles loaded', profiles);
  });

  getGraduateProfile = asyncHandler(async (req, res) => {
    const profile = await graduateService.getGraduateProfileByUserId(req.params.userId, req.user);
    sendSuccess(res, 'Graduate profile loaded', profile);
  });

  deleteMyProfile = asyncHandler(async (req, res) => {
    const profile = await graduateService.deleteProfileByGraduateId(req.user._id);
    sendSuccess(res, 'Graduate profile deleted', profile);
  });

  deleteGraduateProfile = asyncHandler(async (req, res) => {
    const profile = await graduateService.deleteGraduateProfileByUserId(req.params.userId);
    sendSuccess(res, 'Graduate profile deleted', profile);
  });
}

const graduateController = new GraduateController();

export const getMyProfile = graduateController.getMyProfile;
export const upsertMyProfile = graduateController.upsertMyProfile;
export const listGraduateProfiles = graduateController.listGraduateProfiles;
export const getGraduateProfile = graduateController.getGraduateProfile;
export const deleteMyProfile = graduateController.deleteMyProfile;
export const deleteGraduateProfile = graduateController.deleteGraduateProfile;
export default graduateController;