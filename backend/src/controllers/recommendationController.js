import {
  deleteRecommendationById,
  getRecommendationForUser,
  listRecommendationsForUser,
  updateRecommendationById,
} from '../services/recommendationService.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const listRecommendations = asyncHandler(async (req, res) => {
  const recommendations = await listRecommendationsForUser(req.user, req.query);
  sendSuccess(res, 'Recommendations loaded', recommendations);
});

export const getRecommendation = asyncHandler(async (req, res) => {
  const recommendation = await getRecommendationForUser(req.params.id, req.user);
  sendSuccess(res, 'Recommendation loaded', recommendation);
});

export const updateRecommendation = asyncHandler(async (req, res) => {
  const recommendation = await updateRecommendationById(req.params.id, req.body);
  sendSuccess(res, 'Recommendation updated', recommendation);
});

export const deleteRecommendation = asyncHandler(async (req, res) => {
  const recommendation = await deleteRecommendationById(req.params.id);
  sendSuccess(res, 'Recommendation deleted', recommendation);
});
