import Competency from "../models/Competency.js";
import Checklist from "../models/Checklist.js";
import { AppError } from "./errorService.js";
import { isLearnerRole } from "../constants/roles.js";
import { buildSubmissionContract } from "./githubService.js";

// Every practical task gets a computed submissionContract so learners always
// know exactly which language(s), execution protocol, sample test cases, and
// competra.json shape the automatic grader expects - see buildSubmissionContract.
function attachSubmissionContract(task) {
  return { ...task, submissionContract: buildSubmissionContract(task) };
}

export function hideCorrectAnswers(competency) {
  const data = competency.toObject ? competency.toObject() : competency;

  return {
    ...data,
    practicalTasks: (data.practicalTasks || []).map((task) => {
      const safeTask = attachSubmissionContract(task);
      delete safeTask.automatedTestCommand;
      delete safeTask.automatedTestFiles;
      // hiddenTestCases carries the exact expected output for hidden checks -
      // it must never reach a learner, only the count is safe to reveal
      // (already exposed via submissionContract.hiddenTestCaseCount).
      delete safeTask.hiddenTestCases;
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
  if (isLearnerRole(role)) return hideCorrectAnswers(competency);

  const data = competency.toObject ? competency.toObject() : competency;
  return {
    ...data,
    practicalTasks: (data.practicalTasks || []).map(attachSubmissionContract),
  };
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

// The competency code identifies the competency across the system (assessments,
// checklists, reports), so it must never be typed by an admin: a typo or a
// reused value would silently collide with another competency. Instead it is
// derived from the category (e.g. "frontend" -> "FE") plus the next free
// sequence number for that prefix, guaranteeing uniqueness automatically.
function competencyCodePrefixFromCategory(category) {
  const letters = String(category || "").toUpperCase().replace(/[^A-Z]/g, "");
  return letters.slice(0, 3) || "GEN";
}

async function nextCompetencyCodeSequence(prefix) {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedPrefix}-(\\d+)$`);
  const existingCodes = await Competency.find({ code: pattern }).select("code").lean();

  const highestSequence = existingCodes.reduce((max, item) => {
    const match = item.code.match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return highestSequence + 1;
}

async function generateUniqueCompetencyCode(category) {
  const prefix = competencyCodePrefixFromCategory(category);
  let sequence = await nextCompetencyCodeSequence(prefix);
  let code = `${prefix}-${String(sequence).padStart(3, "0")}`;

  // Defends against a race between two admins creating a competency in the
  // same category at the same instant.
  while (await Competency.exists({ code })) {
    sequence += 1;
    code = `${prefix}-${String(sequence).padStart(3, "0")}`;
  }

  return code;
}

export async function createCompetency(payload, createdBy) {
  const competencyData = { ...payload };
  delete competencyData.code;

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const code = await generateUniqueCompetencyCode(competencyData.category);
    try {
      return await Competency.create({ ...competencyData, code, createdBy });
    } catch (error) {
      const isDuplicateCodeRace = error.code === 11000 && attempt < maxAttempts;
      if (!isDuplicateCodeRace) throw error;
    }
  }

  throw new AppError("Failed to generate a unique competency code", 500);
}

export async function updateCompetencyById(competencyId, payload) {
  const updates = { ...payload };
  delete updates.code;

  const competency = await Competency.findByIdAndUpdate(competencyId, updates, {
    new: true,
    runValidators: true,
  });

  if (!competency) {
    throw new AppError("Competency was not found", 404);
  }

  return competency;
}

export async function activateCompetencyById(competencyId) {
  const competency = await Competency.findByIdAndUpdate(
    competencyId,
    { isActive: true },
    { new: true, runValidators: true },
  );

  if (!competency) {
    throw new AppError("Competency was not found", 404);
  }

  await Checklist.updateMany({ competency: competency._id }, { isActive: true });
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
  activateCompetencyById = activateCompetencyById;
  deactivateCompetencyById = deactivateCompetencyById;
}

const competencyService = new CompetencyService();

export default competencyService;
