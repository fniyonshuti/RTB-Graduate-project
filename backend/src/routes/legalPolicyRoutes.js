import express from "express";
import {
  archivePolicy,
  createPolicy,
  currentPolicies,
  listPolicies,
  publishPolicy,
  updatePolicy,
} from "../controllers/legalPolicyController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/current", currentPolicies);

router.use(protect);
router.use(authorize("super_admin"));

router.route("/").get(listPolicies).post(createPolicy);
router.route("/:id").put(updatePolicy).delete(archivePolicy);
router.patch("/:id/publish", publishPolicy);

export default router;
