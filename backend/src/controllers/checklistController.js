import checklistService from "../services/checklistService.js";
import { asyncHandler } from "../services/errorService.js";
import { sendSuccess } from "../services/responseService.js";

class ChecklistController {
  listChecklists = asyncHandler(async (req, res) => {
    const checklists = await checklistService.listChecklists(req.query);
    sendSuccess(res, "Repository review checklists loaded", checklists);
  });

  createChecklist = asyncHandler(async (req, res) => {
    const checklist = await checklistService.createChecklist(req.body, req.user._id);
    sendSuccess(res, "Repository review checklist created", checklist, 201);
  });

  getChecklist = asyncHandler(async (req, res) => {
    const checklist = await checklistService.getChecklistById(req.params.id);
    sendSuccess(res, "Repository review checklist loaded", checklist);
  });

  updateChecklist = asyncHandler(async (req, res) => {
    const checklist = await checklistService.updateChecklistById(req.params.id, req.body);
    sendSuccess(res, "Repository review checklist updated", checklist);
  });

  deleteChecklist = asyncHandler(async (req, res) => {
    const checklist = await checklistService.deactivateChecklistById(req.params.id);
    sendSuccess(res, "Repository review checklist deactivated", checklist);
  });
}

const checklistController = new ChecklistController();

export const listChecklists = checklistController.listChecklists;
export const createChecklist = checklistController.createChecklist;
export const getChecklist = checklistController.getChecklist;
export const updateChecklist = checklistController.updateChecklist;
export const deleteChecklist = checklistController.deleteChecklist;
export default checklistController;
