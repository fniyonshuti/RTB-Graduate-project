import assessmentService from '../services/assessmentService.js';
import { asyncHandler } from '../services/errorService.js';
import { sendSuccess } from '../services/responseService.js';

class AssessmentController {
  createAssessment = asyncHandler(async (req, res) => {
    const assessment = await assessmentService.submitAssessment(req.user, req.body);
    sendSuccess(res, 'Assessment scored automatically', assessment, 201);
  });

  reviewRepositoryTask = asyncHandler(async (req, res) => {
    const review = await assessmentService.previewRepositoryTaskReview(req.body, req.user);
    sendSuccess(res, 'Repository task review completed', review);
  });

  getAssessments = asyncHandler(async (req, res) => {
    const assessments = await assessmentService.listAssessments(req.user, req.query);
    sendSuccess(res, 'Assessments loaded', assessments);
  });

  getAssessment = asyncHandler(async (req, res) => {
    const assessment = await assessmentService.getAssessmentById(req.params.id, req.user);
    sendSuccess(res, 'Assessment loaded', assessment);
  });

  updateAssessment = asyncHandler(async (req, res) => {
    const assessment = await assessmentService.updateAssessmentById(req.params.id, req.user, req.body);
    sendSuccess(res, 'Assessment updated', assessment);
  });

  deleteAssessment = asyncHandler(async (req, res) => {
    const assessment = await assessmentService.deleteAssessmentById(req.params.id, req.user);
    sendSuccess(res, 'Assessment deleted', assessment);
  });

  review = asyncHandler(async (req, res) => {
    const result = await assessmentService.reviewAssessment(req.params.id, req.user._id, req.body);
    sendSuccess(res, 'Assessment reviewed successfully', result);
  });

  previewReviewRecommendation = asyncHandler(async (req, res) => {
    const draft = await assessmentService.previewRecommendationDraft(req.params.id, req.body);
    sendSuccess(res, 'Recommendation draft generated', draft);
  });

  myResults = asyncHandler(async (req, res) => {
    const results = await assessmentService.getGraduateResults(req.user._id);
    sendSuccess(res, 'Gap analysis results loaded', results);
  });

  myResult = asyncHandler(async (req, res) => {
    const result = await assessmentService.getGraduateResultById(req.user._id, req.params.id);
    sendSuccess(res, 'Gap analysis result loaded', result);
  });
}

const assessmentController = new AssessmentController();

export const createAssessment = assessmentController.createAssessment;
export const reviewRepositoryTask = assessmentController.reviewRepositoryTask;
export const getAssessments = assessmentController.getAssessments;
export const getAssessment = assessmentController.getAssessment;
export const updateAssessment = assessmentController.updateAssessment;
export const deleteAssessment = assessmentController.deleteAssessment;
export const review = assessmentController.review;
export const previewReviewRecommendation = assessmentController.previewReviewRecommendation;
export const myResults = assessmentController.myResults;
export const myResult = assessmentController.myResult;
export default assessmentController;
