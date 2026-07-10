import dashboardService from '../services/dashboardService.js';
import { asyncHandler } from '../services/errorService.js';
import { sendSuccess } from '../services/responseService.js';
import { isLearnerRole } from '../constants/roles.js';

class DashboardController {
  getDashboard = asyncHandler(async (req, res) => {
    if (isLearnerRole(req.user.role)) {
      const dashboard = await dashboardService.getGraduateDashboard(req.user._id);
      return sendSuccess(res, 'User dashboard loaded', dashboard);
    }

    const dashboard = await dashboardService.getAdminDashboard(req.user);
    return sendSuccess(res, 'Admin dashboard loaded', dashboard);
  });
}

const dashboardController = new DashboardController();

export const getDashboard = dashboardController.getDashboard;
export default dashboardController;