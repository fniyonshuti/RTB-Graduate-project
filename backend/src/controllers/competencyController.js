import Competency from '../models/Competency.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

function hideCorrectAnswers(competency) {
  const data = competency.toObject ? competency.toObject() : competency;

  return {
    ...data,
    theoryQuestions: (data.theoryQuestions || []).map((question) => {
      const { correctAnswer, ...safeQuestion } = question;
      return safeQuestion;
    }),
  };
}

function formatCompetencyForRole(competency, role) {
  return role === 'graduate' ? hideCorrectAnswers(competency) : competency;
}

export const listCompetencies = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.activeOnly === 'true') query.isActive = true;
  if (req.query.category) query.category = req.query.category;

  const competencies = await Competency.find(query).sort({ category: 1, title: 1 });
  sendSuccess(
    res,
    'Competencies loaded',
    competencies.map((competency) => formatCompetencyForRole(competency, req.user.role))
  );
});

export const getCompetency = asyncHandler(async (req, res) => {
  const competency = await Competency.findById(req.params.id);

  if (!competency) {
    throw new AppError('Competency was not found', 404);
  }

  sendSuccess(res, 'Competency loaded', formatCompetencyForRole(competency, req.user.role));
});

export const createCompetency = asyncHandler(async (req, res) => {
  const competency = await Competency.create({
    ...req.body,
    createdBy: req.user._id,
  });

  sendSuccess(res, 'Competency created', competency, 201);
});

export const updateCompetency = asyncHandler(async (req, res) => {
  const competency = await Competency.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!competency) {
    throw new AppError('Competency was not found', 404);
  }

  sendSuccess(res, 'Competency updated', competency);
});
