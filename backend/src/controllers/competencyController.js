import {
  createCompetency as createCompetencyService,
  deactivateCompetencyById,
  getCompetencyForRole,
  listCompetenciesForRole,
  updateCompetencyById,
} from '../services/competencyService.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const listCompetencies = asyncHandler(async (req, res) => {
  const competencies = await listCompetenciesForRole(req.query, req.user.role);
  sendSuccess(res, 'Competencies loaded', competencies);
});

export const getCompetency = asyncHandler(async (req, res) => {
  const competency = await getCompetencyForRole(req.params.id, req.user.role);
  sendSuccess(res, 'Competency loaded', competency);
});

export const createCompetency = asyncHandler(async (req, res) => {
  const competency = await createCompetencyService(req.body, req.user._id);
  sendSuccess(res, 'Competency created', competency, 201);
});

export const updateCompetency = asyncHandler(async (req, res) => {
  const competency = await updateCompetencyById(req.params.id, req.body);
  sendSuccess(res, 'Competency updated', competency);
});

export const deleteCompetency = asyncHandler(async (req, res) => {
  const competency = await deactivateCompetencyById(req.params.id);
  sendSuccess(res, 'Competency deactivated', competency);
});
