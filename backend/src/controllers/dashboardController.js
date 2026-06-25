import {
  getGraduateDashboard,
  getAssessorDashboard,
  getAdminDashboard,
} from '../services/dashboardService.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const getDashboard = asyncHandler(async (req, res) => {
  if (req.user.role === 'graduate') {
    const dashboard = await getGraduateDashboard(req.user._id);
    return sendSuccess(res, 'Graduate dashboard loaded', dashboard);
  }

  if (req.user.role === 'assessor') {
    const dashboard = await getAssessorDashboard(req.user._id);
    return sendSuccess(res, 'Assessor dashboard loaded', dashboard);
  }

  const dashboard = await getAdminDashboard();
  return sendSuccess(res, 'Admin dashboard loaded', dashboard);
});
