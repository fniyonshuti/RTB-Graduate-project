import { asyncHandler, AppError } from '../services/errorService.js';
import { sendSuccess } from '../services/responseService.js';
import githubService from '../services/githubService.js';

class GitHubController {
  createRepositoryAssessment = asyncHandler(async (req, res) => {
    const { repositoryUrl, competency, practicalTaskId } = req.body;

    if (!repositoryUrl) {
      throw new AppError('GitHub repository URL is required.', 400);
    }

    const result = await githubService.assessGithubRepository({
      repositoryUrl,
      competencyId: competency,
      practicalTaskId,
      user: req.user,
    });

    sendSuccess(res, 'Repository assessment completed.', result, 201);
  });

  getRepositoryAssessments = asyncHandler(async (req, res) => {
    const results = await githubService.listRepositoryAssessmentResults(req.user);
    sendSuccess(res, 'Repository assessment results retrieved.', results);
  });

  getRepositoryAssessment = asyncHandler(async (req, res) => {
    const result = await githubService.getRepositoryAssessmentResult(req.params.id, req.user);
    sendSuccess(res, 'Repository assessment result retrieved.', result);
  });

  updateRepositoryAssessment = asyncHandler(async (req, res) => {
    const result = await githubService.updateRepositoryAssessmentResult(req.params.id, req.body);
    sendSuccess(res, 'Repository assessment result updated.', result);
  });

  deleteRepositoryAssessment = asyncHandler(async (req, res) => {
    const result = await githubService.deleteRepositoryAssessmentResult(req.params.id, req.user);
    sendSuccess(res, 'Repository assessment result deleted.', result);
  });
}

const githubController = new GitHubController();

export const createRepositoryAssessment = githubController.createRepositoryAssessment;
export const getRepositoryAssessments = githubController.getRepositoryAssessments;
export const getRepositoryAssessment = githubController.getRepositoryAssessment;
export const updateRepositoryAssessment = githubController.updateRepositoryAssessment;
export const deleteRepositoryAssessment = githubController.deleteRepositoryAssessment;
export default githubController;