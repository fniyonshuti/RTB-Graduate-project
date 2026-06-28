import { listRecommendationsForUser } from '../services/recommendationService.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const listRecommendations = asyncHandler(async (req, res) => {
  const recommendations = await listRecommendationsForUser(req.user, req.query);
  sendSuccess(res, 'Recommendations loaded', recommendations);
});
