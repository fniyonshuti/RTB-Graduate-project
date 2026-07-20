import LegalPolicy from "../models/LegalPolicy.js";
import { AppError } from "./errorService.js";

const POLICY_TYPES = ["terms", "privacy"];

function normalizePolicyPayload(payload = {}) {
  let documentFile = null;
  if (payload.documentFile && payload.documentFile.name && payload.documentFile.dataUrl) {
    documentFile = {
      name: String(payload.documentFile.name).trim(),
      type: payload.documentFile.type ? String(payload.documentFile.type).trim() : undefined,
      size: typeof payload.documentFile.size === "number" ? payload.documentFile.size : undefined,
      dataUrl: String(payload.documentFile.dataUrl),
    };
  }
  return {
    type: String(payload.type || "").trim().toLowerCase(),
    title: String(payload.title || "").trim(),
    version: String(payload.version || "").trim(),
    content: String(payload.content || "").trim(),
    isActive: payload.isActive !== false,
    documentFile,
  };
}

function validatePolicyPayload(payload, { partial = false } = {}) {
  if (!partial || payload.type !== undefined) {
    if (!POLICY_TYPES.includes(payload.type)) {
      throw new AppError("Select a valid policy type.", 400);
    }
  }

  if (!partial || payload.title !== undefined) {
    if (!payload.title || payload.title.length < 3) {
      throw new AppError("Policy title must be at least 3 characters.", 400);
    }
  }

  if (!partial || payload.version !== undefined) {
    if (!payload.version || payload.version.length < 2) {
      throw new AppError("Policy version is required.", 400);
    }
  }

  if (!partial || payload.content !== undefined) {
    if (!payload.content || payload.content.length < 20) {
      throw new AppError("Policy content must be at least 20 characters.", 400);
    }
  }
}

export function serializeLegalPolicy(policy) {
  if (!policy) return null;

  return {
    _id: policy._id,
    type: policy.type,
    title: policy.title,
    version: policy.version,
    content: policy.content,
    documentFile: policy.documentFile?.dataUrl
      ? {
          name: policy.documentFile.name,
          type: policy.documentFile.type,
          size: policy.documentFile.size,
          dataUrl: policy.documentFile.dataUrl,
        }
      : null,
    status: policy.status,
    isActive: policy.isActive,
    publishedAt: policy.publishedAt,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
    createdBy: policy.createdBy,
    updatedBy: policy.updatedBy,
  };
}

export async function listLegalPolicies(filters = {}) {
  const query = {};

  if (filters.type && POLICY_TYPES.includes(String(filters.type))) {
    query.type = filters.type;
  }

  if (filters.status) query.status = filters.status;
  if (filters.activeOnly === "true") query.isActive = true;

  const policies = await LegalPolicy.find(query)
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role")
    .sort({ type: 1, createdAt: -1 });

  return policies.map(serializeLegalPolicy);
}

export async function getCurrentLegalPolicies() {
  const policies = await LegalPolicy.find({
    type: { $in: POLICY_TYPES },
    status: "published",
    isActive: true,
  }).sort({ publishedAt: -1, createdAt: -1 });

  const current = policies.reduce(
    (summary, policy) => {
      if (!summary[policy.type]) summary[policy.type] = serializeLegalPolicy(policy);
      return summary;
    },
    { terms: null, privacy: null },
  );

  return {
    terms: current.terms,
    privacy: current.privacy,
    isReady: Boolean(current.terms && current.privacy),
  };
}

export async function createLegalPolicy(payload, userId) {
  const normalized = normalizePolicyPayload(payload);
  validatePolicyPayload(normalized);

  const policy = await LegalPolicy.create({
    ...normalized,
    status: "draft",
    createdBy: userId,
    updatedBy: userId,
  });

  return serializeLegalPolicy(policy);
}

export async function updateLegalPolicy(policyId, payload, userId) {
  const current = await LegalPolicy.findById(policyId);

  if (!current || !current.isActive) {
    throw new AppError("Policy was not found.", 404);
  }

  if (current.status === "published") {
    throw new AppError("Published policies cannot be edited. Create a new version instead.", 400);
  }

  const normalized = normalizePolicyPayload({ ...current.toObject(), ...payload });
  validatePolicyPayload(normalized);

  current.type = normalized.type;
  current.title = normalized.title;
  current.version = normalized.version;
  current.content = normalized.content;
  current.isActive = normalized.isActive;
  current.documentFile = normalized.documentFile ?? current.documentFile;
  current.updatedBy = userId;
  await current.save();

  return serializeLegalPolicy(current);
}

export async function publishLegalPolicy(policyId, userId) {
  const policy = await LegalPolicy.findById(policyId);

  if (!policy || !policy.isActive) {
    throw new AppError("Policy was not found.", 404);
  }

  validatePolicyPayload(normalizePolicyPayload(policy.toObject()));

  await LegalPolicy.updateMany(
    {
      _id: { $ne: policy._id },
      type: policy.type,
      status: "published",
      isActive: true,
    },
    { status: "archived" },
  );

  policy.status = "published";
  policy.publishedAt = new Date();
  policy.updatedBy = userId;
  await policy.save();

  return serializeLegalPolicy(policy);
}

export async function archiveLegalPolicy(policyId, userId) {
  const policy = await LegalPolicy.findById(policyId);

  if (!policy || !policy.isActive) {
    throw new AppError("Policy was not found.", 404);
  }

  policy.status = "archived";
  policy.isActive = false;
  policy.updatedBy = userId;
  await policy.save();

  return serializeLegalPolicy(policy);
}

class LegalPolicyService {
  listLegalPolicies = listLegalPolicies;
  getCurrentLegalPolicies = getCurrentLegalPolicies;
  createLegalPolicy = createLegalPolicy;
  updateLegalPolicy = updateLegalPolicy;
  publishLegalPolicy = publishLegalPolicy;
  archiveLegalPolicy = archiveLegalPolicy;
}

export default new LegalPolicyService();
