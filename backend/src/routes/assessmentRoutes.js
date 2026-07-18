import express from "express";
import {
  createAssessment,
  getAssessments,
  getAssessment,
  review,
  updateAssessment,
  deleteAssessment,
  myResults,
  myResult,
  previewReviewRecommendation,
  reviewRepositoryTask,
} from "../controllers/assessmentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";
import {
  requireFields,
  validateAssessmentReview,
  validateAssessmentSubmission,
  validateRepositoryTaskReview,
} from "../middleware/validateMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/results/me", authorize("learner"), myResults);
router.get("/results/:id", authorize("learner"), myResult);

router.post(
  "/repository-task-review",
  authorize("learner"),
  requireFields("competency", "githubRepositoryUrl"),
  validateRepositoryTaskReview,
  reviewRepositoryTask,
);

router
  .route("/")
  .get(getAssessments)
  .post(authorize("learner"), requireFields("competency"), validateAssessmentSubmission, createAssessment);

router
  .route("/:id")
  .get(getAssessment)
  .put(authorize("learner", "admin", "org_admin"), validateAssessmentSubmission, updateAssessment)
  .delete(authorize("learner", "admin", "org_admin"), deleteAssessment);
router.put(
  "/:id/review",
  authorize("admin"),
  requireFields(
    "practicalTaskScore",
    "quizScore",
  ),
  validateAssessmentReview,
  review,
);

router.post(
  "/:id/recommendation-preview",
  authorize("admin"),
  requireFields(
    "practicalTaskScore",
    "quizScore",
  ),
  validateAssessmentReview,
  previewReviewRecommendation,
);

export default router;
