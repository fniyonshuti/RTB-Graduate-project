import express from "express";
import {
  listChecklists,
  createChecklist,
  getChecklist,
  updateChecklist,
  deleteChecklist,
} from "../controllers/checklistController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";
import { requireFields } from "../middleware/validateMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(authorize("admin", "super_admin"));

router
  .route("/")
  .get(listChecklists)
  .post(requireFields("competency", "practicalTaskId", "items"), createChecklist);

router
  .route("/:id")
  .get(getChecklist)
  .put(updateChecklist)
  .delete(deleteChecklist);

export default router;
