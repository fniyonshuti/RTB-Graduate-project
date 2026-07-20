import legalPolicyService from "../services/legalPolicyService.js";
import { asyncHandler } from "../services/errorService.js";
import { sendSuccess } from "../services/responseService.js";

class LegalPolicyController {
  currentPolicies = asyncHandler(async (req, res) => {
    const policies = await legalPolicyService.getCurrentLegalPolicies();
    sendSuccess(res, "Legal policies loaded", policies);
  });

  listPolicies = asyncHandler(async (req, res) => {
    const policies = await legalPolicyService.listLegalPolicies(req.query);
    sendSuccess(res, "Legal policies loaded", policies);
  });

  createPolicy = asyncHandler(async (req, res) => {
    const policy = await legalPolicyService.createLegalPolicy(req.body, req.user._id);
    sendSuccess(res, "Policy draft created", policy, 201);
  });

  updatePolicy = asyncHandler(async (req, res) => {
    const policy = await legalPolicyService.updateLegalPolicy(req.params.id, req.body, req.user._id);
    sendSuccess(res, "Policy draft updated", policy);
  });

  publishPolicy = asyncHandler(async (req, res) => {
    const policy = await legalPolicyService.publishLegalPolicy(req.params.id, req.user._id);
    sendSuccess(res, "Policy published", policy);
  });

  archivePolicy = asyncHandler(async (req, res) => {
    const policy = await legalPolicyService.archiveLegalPolicy(req.params.id, req.user._id);
    sendSuccess(res, "Policy archived", policy);
  });
}

const legalPolicyController = new LegalPolicyController();

export const currentPolicies = legalPolicyController.currentPolicies;
export const listPolicies = legalPolicyController.listPolicies;
export const createPolicy = legalPolicyController.createPolicy;
export const updatePolicy = legalPolicyController.updatePolicy;
export const publishPolicy = legalPolicyController.publishPolicy;
export const archivePolicy = legalPolicyController.archivePolicy;
export default legalPolicyController;
