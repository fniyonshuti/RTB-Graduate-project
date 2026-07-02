import {
  deleteReportForUser,
  generateGraduateReport,
  getReportForUser,
  listReportsForUser,
  updateReportById,
} from '../services/reportService.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const createReport = asyncHandler(async (req, res) => {
  const graduateId =
    req.user.role === 'graduate' ? req.user._id : req.body.graduateId;
  const report = await generateGraduateReport(graduateId, req.user);
  sendSuccess(res, 'Report generated successfully', report, 201);
});

export const listReports = asyncHandler(async (req, res) => {
  const reports = await listReportsForUser(req.user);
  sendSuccess(res, 'Reports loaded', reports);
});

export const getReport = asyncHandler(async (req, res) => {
  const report = await getReportForUser(req.params.id, req.user);
  sendSuccess(res, 'Report loaded', report);
});

export const updateReport = asyncHandler(async (req, res) => {
  const report = await updateReportById(req.params.id, req.body, req.user);
  sendSuccess(res, 'Report updated', report);
});

export const deleteReport = asyncHandler(async (req, res) => {
  const report = await deleteReportForUser(req.params.id, req.user);
  sendSuccess(res, 'Report deleted', report);
});
