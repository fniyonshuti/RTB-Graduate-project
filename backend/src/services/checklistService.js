import Checklist from "../models/Checklist.js";
import Competency from "../models/Competency.js";
import { AppError } from "./errorService.js";

function normalizeChecklistItems(items = []) {
  return items
    .map((item, index) => {
      const title = String(item.title || "").trim();
      const weight = Math.min(Math.max(Number(item.weight || 0), 1), 100);

      return {
        key: item.key || `checklist-${index + 1}`,
        title,
        description: String(item.description || "").trim(),
        category: item.category || "general",
        validationType: item.validationType || "implementation_review",
        maxScore: weight,
        weight,
        successThreshold: Number.isFinite(Number(item.successThreshold))
          ? Math.min(Math.max(Number(item.successThreshold), 0), 100)
          : 70,
        feedbackWhenFailed: String(item.feedbackWhenFailed || "").trim(),
      };
    })
    .filter((item) => item.title);
}

function validateChecklistItems(items = []) {
  if (!items.length) {
    throw new AppError("Add at least one checklist requirement before saving.", 400);
  }

  const totalWeight = items.reduce((sum, item) => sum + Number(item.weight || 0), 0);

  if (totalWeight !== 100) {
    throw new AppError(`Checklist weight must total 100. Current total is ${totalWeight}.`, 400);
  }
}

async function findCompetencyTask(competencyId, practicalTaskId) {
  const competency = await Competency.findById(competencyId);

  if (!competency) {
    throw new AppError("Competency was not found", 404);
  }

  const practicalTask = (competency.practicalTasks || []).find(
    (task) => String(task._id) === String(practicalTaskId),
  );

  if (!practicalTask) {
    throw new AppError("Practical task was not found for the selected competency", 404);
  }

  return { competency, practicalTask };
}

async function syncCompetencyTaskChecklist(competencyId, practicalTaskId, items) {
  const competency = await Competency.findById(competencyId);

  if (!competency) return;

  const task = (competency.practicalTasks || []).find(
    (item) => String(item._id) === String(practicalTaskId),
  );

  if (!task) return;

  task.reviewChecklist = items;
  await competency.save();
}

export function listChecklists(filters = {}) {
  const query = {};

  if (filters.activeOnly === "true") query.isActive = true;
  if (filters.competency) query.competency = filters.competency;
  if (filters.practicalTaskId) query.practicalTaskId = filters.practicalTaskId;

  return Checklist.find(query)
    .populate("competency", "title code category practicalTasks")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 });
}

export async function getChecklistById(checklistId) {
  const checklist = await Checklist.findById(checklistId)
    .populate("competency", "title code category practicalTasks")
    .populate("createdBy", "name email");

  if (!checklist) {
    throw new AppError("Repository review checklist was not found", 404);
  }

  return checklist;
}

export async function createChecklist(payload, createdBy) {
  const items = normalizeChecklistItems(payload.items || []);
  validateChecklistItems(items);

  const { competency, practicalTask } = await findCompetencyTask(
    payload.competency,
    payload.practicalTaskId,
  );

  await Checklist.updateMany(
    {
      competency: competency._id,
      practicalTaskId: practicalTask._id,
      isActive: true,
    },
    { isActive: false },
  );

  const checklist = await Checklist.create({
    competency: competency._id,
    practicalTaskId: practicalTask._id,
    title: payload.title?.trim() || `${competency.code} - ${practicalTask.title}`,
    items,
    createdBy,
    isActive: payload.isActive !== false,
  });

  if (checklist.isActive) {
    await syncCompetencyTaskChecklist(competency._id, practicalTask._id, items);
  }

  return getChecklistById(checklist._id);
}

export async function updateChecklistById(checklistId, payload) {
  const current = await Checklist.findById(checklistId);

  if (!current) {
    throw new AppError("Repository review checklist was not found", 404);
  }

  const competencyId = payload.competency || current.competency;
  const practicalTaskId = payload.practicalTaskId || current.practicalTaskId;
  const items = payload.items ? normalizeChecklistItems(payload.items) : current.items;
  validateChecklistItems(items);

  const { competency, practicalTask } = await findCompetencyTask(competencyId, practicalTaskId);
  const nextIsActive = payload.isActive !== undefined ? payload.isActive : current.isActive;

  if (nextIsActive) {
    await Checklist.updateMany(
      {
        _id: { $ne: current._id },
        competency: competency._id,
        practicalTaskId: practicalTask._id,
        isActive: true,
      },
      { isActive: false },
    );
  }

  current.competency = competency._id;
  current.practicalTaskId = practicalTask._id;
  current.title = payload.title?.trim() || `${competency.code} - ${practicalTask.title}`;
  current.items = items;
  current.isActive = nextIsActive;
  await current.save();

  await syncCompetencyTaskChecklist(
    competency._id,
    practicalTask._id,
    nextIsActive ? items : [],
  );

  return getChecklistById(current._id);
}

export async function deactivateChecklistById(checklistId) {
  const checklist = await Checklist.findByIdAndUpdate(
    checklistId,
    { isActive: false },
    { new: true, runValidators: true },
  );

  if (!checklist) {
    throw new AppError("Repository review checklist was not found", 404);
  }

  await syncCompetencyTaskChecklist(checklist.competency, checklist.practicalTaskId, []);
  return getChecklistById(checklist._id);
}

class ChecklistService {
  listChecklists = listChecklists;
  getChecklistById = getChecklistById;
  createChecklist = createChecklist;
  updateChecklistById = updateChecklistById;
  deactivateChecklistById = deactivateChecklistById;
}

const checklistService = new ChecklistService();

export default checklistService;
