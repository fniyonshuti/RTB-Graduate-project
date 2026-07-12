import reportService from '../services/reportService.js';
import { asyncHandler } from '../services/errorService.js';
import { sendSuccess } from '../services/responseService.js';
import { isLearnerRole } from '../constants/roles.js';

class ReportController {
  createReport = asyncHandler(async (req, res) => {
    const graduateId =
      isLearnerRole(req.user.role) ? req.user._id : req.body.graduateId;
    const report = await reportService.generateGraduateReport(graduateId, req.user);
    sendSuccess(res, 'Report generated successfully', report, 201);
  });

  listReports = asyncHandler(async (req, res) => {
    const reports = await reportService.listReportsForUser(req.user);
    sendSuccess(res, 'Reports loaded', reports);
  });

  getReport = asyncHandler(async (req, res) => {
    const report = await reportService.getReportForUser(req.params.id, req.user);
    sendSuccess(res, 'Report loaded', report);
  });

  updateReport = asyncHandler(async (req, res) => {
    const report = await reportService.updateReportById(req.params.id, req.body, req.user);
    sendSuccess(res, 'Report updated', report);
  });

  deleteReport = asyncHandler(async (req, res) => {
    const report = await reportService.deleteReportForUser(req.params.id, req.user);
    sendSuccess(res, 'Report deleted', report);
  });
}

const reportController = new ReportController();

export const createReport = reportController.createReport;
export const listReports = reportController.listReports;
export const getReport = reportController.getReport;
export const updateReport = reportController.updateReport;
export const deleteReport = reportController.deleteReport;
export default reportController;