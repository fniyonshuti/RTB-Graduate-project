import {
  getGraduateDashboard,
  getAdminDashboard,
} from '../services/dashboardService.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { isLearnerRole } from '../constants/roles.js';

export const getDashboard = asyncHandler(async (req, res) => {
  if (isLearnerRole(req.user.role)) {
    const dashboard = await getGraduateDashboard(req.user._id);
    return sendSuccess(res, 'User dashboard loaded', dashboard);
  }

  const dashboard = await getAdminDashboard(req.user);
  return sendSuccess(res, 'Admin dashboard loaded', dashboard);
});
