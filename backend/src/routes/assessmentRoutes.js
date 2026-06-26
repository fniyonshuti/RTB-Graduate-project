import express from "express";
import {
  createAssessment,
  getAssessments,
  getAssessment,
  review,
  myResults,
  previewReviewRecommendation,
} from "../controllers/assessmentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";
import { requireFields } from "../middleware/validateMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/results/me", authorize("graduate"), myResults);

router
  .route("/")
  .get(getAssessments)
  .post(authorize("graduate"), requireFields("competency"), createAssessment);

router.get("/:id", getAssessment);
router.put(
  "/:id/review",
  authorize("assessor", "admin"),
  requireFields(
    "practicalTaskScore",
    "quizScore",
    "portfolioScore",
    "selfAssessmentScore",
  ),
  review,
);

router.post(
  "/:id/recommendation-preview",
  authorize("assessor", "admin"),
  requireFields(
    "practicalTaskScore",
    "quizScore",
    "portfolioScore",
    "selfAssessmentScore",
  ),
  previewReviewRecommendation,
);

export default router;
