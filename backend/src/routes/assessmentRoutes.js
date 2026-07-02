import express from "express";
import {
  createAssessment,
  getAssessments,
  getAssessment,
  review,
  updateAssessment,
  deleteAssessment,
  myResults,
  previewReviewRecommendation,
  reviewRepositoryTask,
} from "../controllers/assessmentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";
import { requireFields } from "../middleware/validateMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/results/me", authorize("graduate"), myResults);

router.post(
  "/repository-task-review",
  authorize("graduate"),
  requireFields("competency", "githubRepositoryUrl"),
  reviewRepositoryTask,
);

router
  .route("/")
  .get(getAssessments)
  .post(authorize("graduate"), requireFields("competency"), createAssessment);

router
  .route("/:id")
  .get(getAssessment)
  .put(authorize("graduate", "admin", "org_admin"), updateAssessment)
  .delete(authorize("graduate", "admin", "org_admin"), deleteAssessment);
router.put(
  "/:id/review",
  authorize("assessor", "admin"),
  requireFields(
    "practicalTaskScore",
    "quizScore",
  ),
  review,
);

router.post(
  "/:id/recommendation-preview",
  authorize("assessor", "admin"),
  requireFields(
    "practicalTaskScore",
    "quizScore",
  ),
  previewReviewRecommendation,
);

export default router;
