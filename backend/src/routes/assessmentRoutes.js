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

router.get("/results/me", authorize("learner"), myResults);

router.post(
  "/repository-task-review",
  authorize("learner"),
  requireFields("competency", "githubRepositoryUrl"),
  reviewRepositoryTask,
);

router
  .route("/")
  .get(getAssessments)
  .post(authorize("learner"), requireFields("competency"), createAssessment);

router
  .route("/:id")
  .get(getAssessment)
  .put(authorize("learner", "admin", "org_admin"), updateAssessment)
  .delete(authorize("learner", "admin", "org_admin"), deleteAssessment);
router.put(
  "/:id/review",
  authorize("admin"),
  requireFields(
    "practicalTaskScore",
    "quizScore",
  ),
  review,
);

router.post(
  "/:id/recommendation-preview",
  authorize("admin"),
  requireFields(
    "practicalTaskScore",
    "quizScore",
  ),
  previewReviewRecommendation,
);

export default router;
