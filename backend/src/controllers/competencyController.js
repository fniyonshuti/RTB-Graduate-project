import competencyService from '../services/competencyService.js';
import { asyncHandler } from '../services/errorService.js';
import { sendSuccess } from '../services/responseService.js';

class CompetencyController {
  listCompetencies = asyncHandler(async (req, res) => {
    const competencies = await competencyService.listCompetenciesForRole(req.query, req.user.role);
    sendSuccess(res, 'Competencies loaded', competencies);
  });

  getCompetency = asyncHandler(async (req, res) => {
    const competency = await competencyService.getCompetencyForRole(req.params.id, req.user.role);
    sendSuccess(res, 'Competency loaded', competency);
  });

  createCompetency = asyncHandler(async (req, res) => {
    const competency = await competencyService.createCompetency(req.body, req.user._id);
    sendSuccess(res, 'Competency created', competency, 201);
  });

  updateCompetency = asyncHandler(async (req, res) => {
    const competency = await competencyService.updateCompetencyById(req.params.id, req.body);
    sendSuccess(res, 'Competency updated', competency);
  });

  deleteCompetency = asyncHandler(async (req, res) => {
    const competency = await competencyService.deactivateCompetencyById(req.params.id);
    sendSuccess(res, 'Competency deactivated', competency);
  });
}

const competencyController = new CompetencyController();

export const listCompetencies = competencyController.listCompetencies;
export const getCompetency = competencyController.getCompetency;
export const createCompetency = competencyController.createCompetency;
export const updateCompetency = competencyController.updateCompetency;
export const deleteCompetency = competencyController.deleteCompetency;
export default competencyController;