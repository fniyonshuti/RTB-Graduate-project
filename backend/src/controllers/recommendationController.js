import recommendationService from '../services/recommendationService.js';
import { asyncHandler } from '../services/errorService.js';
import { sendSuccess } from '../services/responseService.js';

class RecommendationController {
  listRecommendations = asyncHandler(async (req, res) => {
    const recommendations = await recommendationService.listRecommendationsForUser(req.user, req.query);
    sendSuccess(res, 'Recommendations loaded', recommendations);
  });

  getRecommendation = asyncHandler(async (req, res) => {
    const recommendation = await recommendationService.getRecommendationForUser(req.params.id, req.user);
    sendSuccess(res, 'Recommendation loaded', recommendation);
  });

  updateRecommendation = asyncHandler(async (req, res) => {
    const recommendation = await recommendationService.updateRecommendationById(req.params.id, req.body);
    sendSuccess(res, 'Recommendation updated', recommendation);
  });

  deleteRecommendation = asyncHandler(async (req, res) => {
    const recommendation = await recommendationService.deleteRecommendationById(req.params.id);
    sendSuccess(res, 'Recommendation deleted', recommendation);
  });
}

const recommendationController = new RecommendationController();

export const listRecommendations = recommendationController.listRecommendations;
export const getRecommendation = recommendationController.getRecommendation;
export const updateRecommendation = recommendationController.updateRecommendation;
export const deleteRecommendation = recommendationController.deleteRecommendation;
export default recommendationController;