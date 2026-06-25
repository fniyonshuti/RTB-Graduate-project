import {
  generateGraduateReport,
  listReportsForUser,
} from '../services/reportService.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const createReport = asyncHandler(async (req, res) => {
  const graduateId =
    req.user.role === 'graduate' ? req.user._id : req.body.graduateId;
  const report = await generateGraduateReport(graduateId, req.user._id);
  sendSuccess(res, 'Report generated successfully', report, 201);
});

export const listReports = asyncHandler(async (req, res) => {
  const reports = await listReportsForUser(req.user);
  sendSuccess(res, 'Reports loaded', reports);
});
