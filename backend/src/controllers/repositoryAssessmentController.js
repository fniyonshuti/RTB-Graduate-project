import { asyncHandler, AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import {
  assessGithubRepository,
  deleteRepositoryAssessmentResult,
  getRepositoryAssessmentResult,
  listRepositoryAssessmentResults,
  updateRepositoryAssessmentResult,
} from '../services/repositoryAssessmentService.js';

export const createRepositoryAssessment = asyncHandler(async (req, res) => {
  const { repositoryUrl, competency, practicalTaskId } = req.body;

  if (!repositoryUrl) {
    throw new AppError('GitHub repository URL is required.', 400);
  }

  const result = await assessGithubRepository({
    repositoryUrl,
    competencyId: competency,
    practicalTaskId,
    user: req.user,
  });

  sendSuccess(res, 'Repository assessment completed.', result, 201);
});

export const getRepositoryAssessments = asyncHandler(async (req, res) => {
  const results = await listRepositoryAssessmentResults(req.user);
  sendSuccess(res, 'Repository assessment results retrieved.', results);
});

export const getRepositoryAssessment = asyncHandler(async (req, res) => {
  const result = await getRepositoryAssessmentResult(req.params.id, req.user);
  sendSuccess(res, 'Repository assessment result retrieved.', result);
});

export const updateRepositoryAssessment = asyncHandler(async (req, res) => {
  const result = await updateRepositoryAssessmentResult(req.params.id, req.body);
  sendSuccess(res, 'Repository assessment result updated.', result);
});

export const deleteRepositoryAssessment = asyncHandler(async (req, res) => {
  const result = await deleteRepositoryAssessmentResult(req.params.id, req.user);
  sendSuccess(res, 'Repository assessment result deleted.', result);
});
