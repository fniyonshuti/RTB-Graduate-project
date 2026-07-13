import Competency from "../models/Competency.js";
import Checklist from "../models/Checklist.js";
import { AppError } from "./errorService.js";
import { isLearnerRole } from "../constants/roles.js";

function hideCorrectAnswers(competency) {
  const data = competency.toObject ? competency.toObject() : competency;

  return {
    ...data,
    practicalTasks: (data.practicalTasks || []).map((task) => {
      const safeTask = { ...task };
      delete safeTask.automatedTestCommand;
      delete safeTask.automatedTestFiles;
      return safeTask;
    }),
    theoryQuestions: (data.theoryQuestions || []).map((question) => {
      const safeQuestion = { ...question };
      delete safeQuestion.correctAnswer;
      return safeQuestion;
    }),
  };
}

function formatCompetencyForRole(competency, role) {
  return isLearnerRole(role) ? hideCorrectAnswers(competency) : competency;
}

export async function listCompetenciesForRole(filters = {}, role) {
  const query = {};

  if (filters.activeOnly === "true") query.isActive = true;
  if (filters.category) query.category = filters.category;

  const competencies = await Competency.find(query).sort({
    category: 1,
    title: 1,
  });

  return competencies.map((competency) =>
    formatCompetencyForRole(competency, role),
  );
}

export async function getCompetencyForRole(competencyId, role) {
  const competency = await Competency.findById(competencyId);

  if (!competency) {
    throw new AppError("Competency was not found", 404);
  }

  return formatCompetencyForRole(competency, role);
}

export async function createCompetency(payload, createdBy) {
  return Competency.create({
    ...payload,
    createdBy,
  });
}

export async function updateCompetencyById(competencyId, payload) {
  const competency = await Competency.findByIdAndUpdate(competencyId, payload, {
    new: true,
    runValidators: true,
  });

  if (!competency) {
    throw new AppError("Competency was not found", 404);
  }

  return competency;
}

export async function deactivateCompetencyById(competencyId) {
  const competency = await Competency.findByIdAndUpdate(
    competencyId,
    { isActive: false },
    { new: true, runValidators: true },
  );

  if (!competency) {
    throw new AppError("Competency was not found", 404);
  }

  await Checklist.updateMany({ competency: competency._id }, { isActive: false });
  return competency;
}

class CompetencyService {
  listCompetenciesForRole = listCompetenciesForRole;
  getCompetencyForRole = getCompetencyForRole;
  createCompetency = createCompetency;
  updateCompetencyById = updateCompetencyById;
  deactivateCompetencyById = deactivateCompetencyById;
}

const competencyService = new CompetencyService();

export default competencyService;
