import Recommendation from '../models/Recommendation.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const listRecommendations = asyncHandler(async (req, res) => {
  const query = {};

  if (req.user.role === 'graduate') query.graduate = req.user._id;
  if (req.query.graduate && req.user.role !== 'graduate') {
    query.graduate = req.query.graduate;
  }
  if (req.query.competency) query.competency = req.query.competency;

  const recommendations = await Recommendation.find(query)
    .populate('graduate', 'name email institution')
    .populate('competency', 'title code category')
    .populate('assessor', 'name email institution')
    .sort({ createdAt: -1 });

  sendSuccess(res, 'Recommendations loaded', recommendations);
});
