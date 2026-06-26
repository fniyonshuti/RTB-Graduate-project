import {
  submitAssessment,
  listAssessments,
  getAssessmentById,
  reviewAssessment,
  getGraduateResults,
  previewRecommendationDraft,
} from "../services/assessmentService.js";
import { asyncHandler } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

export const createAssessment = asyncHandler(async (req, res) => {
  const assessment = await submitAssessment(req.user._id, req.body);
  sendSuccess(res, "Assessment submitted successfully", assessment, 201);
});

export const getAssessments = asyncHandler(async (req, res) => {
  const assessments = await listAssessments(req.user, req.query);
  sendSuccess(res, "Assessments loaded", assessments);
});

export const getAssessment = asyncHandler(async (req, res) => {
  const assessment = await getAssessmentById(req.params.id, req.user);
  sendSuccess(res, "Assessment loaded", assessment);
});

export const review = asyncHandler(async (req, res) => {
  const result = await reviewAssessment(req.params.id, req.user._id, req.body);
  sendSuccess(res, "Assessment reviewed successfully", result);
});

export const previewReviewRecommendation = asyncHandler(async (req, res) => {
  const draft = await previewRecommendationDraft(req.params.id, req.body);
  sendSuccess(res, "Recommendation draft generated", draft);
});

export const myResults = asyncHandler(async (req, res) => {
  const results = await getGraduateResults(req.user._id);
  sendSuccess(res, "Gap analysis results loaded", results);
});
