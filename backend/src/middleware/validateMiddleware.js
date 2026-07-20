import { USER_ROLE_VALUES } from "../constants/roles.js";
import { checkPasswordPolicy, passwordPolicyMessage } from "../constants/password.js";
import {
  CHECKLIST_CATEGORIES,
  CHECKLIST_VALIDATION_TYPES,
} from "../models/Checklist.js";
import { AppError } from "../services/errorService.js";

const objectIdPattern = /^[a-f\d]{24}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+\d][\d\s().-]{6,24}$/;
const allowedBenchmarkLevels = ["basic", "intermediate", "advanced"];
const allowedOrganizationTypes = ["tvet_institution", "training_center", "other"];
const allowedOrganizationStatuses = ["active", "inactive"];
const allowedGenderValues = ["male", "female", "other", "prefer_not_to_say", ""];
const allowedQuestionTypes = ["multiple_choice", "short_answer"];

function fail(message) {
  throw new AppError(message, 400);
}

function isBlank(value) {
  return value === undefined || value === null || value === "";
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

function assertStringField(body, field, label = field, options = {}) {
  if (isBlank(body[field])) {
    if (options.required === false) return;
    fail(`${label} is required`);
  }

  body[field] = normalizeString(body[field]);

  if (typeof body[field] !== "string") fail(`${label} must be text`);
  if (options.min && body[field].length < options.min) {
    fail(`${label} must be at least ${options.min} characters`);
  }
  if (options.max && body[field].length > options.max) {
    fail(`${label} must not exceed ${options.max} characters`);
  }
}

function assertEmailField(body, field = "email", label = field, options = {}) {
  if (isBlank(body[field])) {
    if (options.required === false) return;
    fail(`${label} is required`);
  }

  body[field] = normalizeEmail(body[field]);
  if (typeof body[field] !== "string" || !emailPattern.test(body[field])) {
    fail(`${label} must be a valid email address`);
  }
}

function assertPasswordField(body, field, label = field, options = {}) {
  if (isBlank(body[field])) {
    if (options.required === false) return;
    fail(`${label} is required`);
  }

  if (typeof body[field] !== "string") fail(`${label} must be text`);
  if (body[field].length > (options.max || 128)) {
    fail(`${label} must not exceed ${options.max || 128} characters`);
  }

  if (options.strong === false) {
    if (body[field].length < (options.min || 1)) fail(`${label} is required`);
    return;
  }

  const policy = checkPasswordPolicy(body[field]);
  if (!policy.isValid) fail(passwordPolicyMessage(label));
}

function assertObjectIdField(body, field, label = field, options = {}) {
  if (isBlank(body[field])) {
    if (options.required === false) return;
    fail(`${label} is required`);
  }

  body[field] = normalizeString(String(body[field]));
  if (!objectIdPattern.test(body[field])) fail(`${label} must be a valid ID`);
}

function assertNumberField(body, field, label = field, options = {}) {
  if (isBlank(body[field])) {
    if (options.required === false) return;
    fail(`${label} is required`);
  }

  const value = Number(body[field]);
  if (!Number.isFinite(value)) fail(`${label} must be a number`);
  if (options.min !== undefined && value < options.min) fail(`${label} must be at least ${options.min}`);
  if (options.max !== undefined && value > options.max) fail(`${label} must not exceed ${options.max}`);
  body[field] = value;
}

function assertBooleanField(body, field, label = field, options = {}) {
  if (isBlank(body[field])) {
    if (options.required === false) return;
    fail(`${label} is required`);
  }

  if (typeof body[field] === "boolean") return;
  if (body[field] === "true") body[field] = true;
  else if (body[field] === "false") body[field] = false;
  else fail(`${label} must be true or false`);
}

function assertEnumField(body, field, allowedValues, label = field, options = {}) {
  if (isBlank(body[field])) {
    if (options.required === false) return;
    fail(`${label} is required`);
  }

  body[field] = normalizeString(String(body[field]));
  if (!allowedValues.includes(body[field])) {
    fail(`${label} must be one of: ${allowedValues.join(", ")}`);
  }
}

function assertUrlField(body, field, label = field, options = {}) {
  if (isBlank(body[field])) {
    if (options.required === false) return;
    fail(`${label} is required`);
  }

  body[field] = normalizeString(String(body[field]));
  try {
    const url = new URL(body[field]);
    if (!options.protocols?.includes(url.protocol)) fail(`${label} must use ${options.protocols.join(" or ")}`);
  } catch {
    fail(`${label} must be a valid URL`);
  }
}

function validatePracticalTasks(tasks = []) {
  if (!Array.isArray(tasks)) fail("Practical tasks must be a list");

  tasks.forEach((task, index) => {
    assertStringField(task, "title", `Practical task ${index + 1} title`, { min: 3, max: 180 });
    assertStringField(task, "instructions", `Practical task ${index + 1} instructions`, { min: 10, max: 5000 });
    assertNumberField(task, "estimatedMinutes", `Practical task ${index + 1} estimated minutes`, { required: false, min: 1, max: 600 });
    assertNumberField(task, "maxScore", `Practical task ${index + 1} max score`, { required: false, min: 1, max: 100 });
    assertNumberField(task, "correctnessWeight", `Practical task ${index + 1} correctness weight`, { required: false, min: 0, max: 100 });
    assertNumberField(task, "codeQualityWeight", `Practical task ${index + 1} code quality weight`, { required: false, min: 0, max: 100 });
    assertNumberField(task, "performanceWeight", `Practical task ${index + 1} performance weight`, { required: false, min: 0, max: 100 });
    assertNumberField(task, "securityWeight", `Practical task ${index + 1} security weight`, { required: false, min: 0, max: 100 });
  });
}

function validateTheoryQuestions(questions = []) {
  if (!Array.isArray(questions)) fail("Theory questions must be a list");

  questions.forEach((question, index) => {
    assertStringField(question, "question", `Theory question ${index + 1}`, { min: 5, max: 2000 });
    assertEnumField(question, "type", allowedQuestionTypes, `Theory question ${index + 1} type`, { required: false });
    assertNumberField(question, "points", `Theory question ${index + 1} points`, { required: false, min: 1, max: 100 });
    if (question.type === "multiple_choice" && (!Array.isArray(question.options) || question.options.length < 2)) {
      fail(`Theory question ${index + 1} must include at least two options`);
    }
  });
}

function validateChecklistItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) fail("Checklist items are required");

  let totalWeight = 0;
  items.forEach((item, index) => {
    assertStringField(item, "title", `Checklist requirement ${index + 1}`, { min: 3, max: 240 });
    assertNumberField(item, "weight", `Checklist requirement ${index + 1} weight`, { min: 1, max: 100 });
    assertNumberField(item, "maxScore", `Checklist requirement ${index + 1} max score`, { required: false, min: 1, max: 100 });
    assertNumberField(item, "successThreshold", `Checklist requirement ${index + 1} success threshold`, { required: false, min: 0, max: 100 });
    assertEnumField(item, "category", CHECKLIST_CATEGORIES, `Checklist requirement ${index + 1} category`, { required: false });
    assertEnumField(item, "validationType", CHECKLIST_VALIDATION_TYPES, `Checklist requirement ${index + 1} validation type`, { required: false });
    item.maxScore = item.maxScore || item.weight;
    totalWeight += item.weight;
  });

  if (totalWeight !== 100) fail(`Checklist weight must total 100. Current total is ${totalWeight}.`);
}

export function requireFields(...fields) {
  return function fieldValidator(req, res, next) {
    try {
      const missingField = fields.find((field) => isBlank(req.body[field]));
      if (missingField) fail(`${missingField} is required`);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function validateRegister(req, res, next) {
  try {
    assertStringField(req.body, "name", "Full name", { min: 2, max: 120 });
    assertEmailField(req.body, "email", "Email");
    assertPasswordField(req.body, "password", "Password");
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateLogin(req, res, next) {
  try {
    assertEmailField(req.body, "email", "Email");
    assertPasswordField(req.body, "password", "Password", { strong: false, min: 1, max: 128 });
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateGoogleLogin(req, res, next) {
  try {
    assertStringField(req.body, "credential", "Google credential", { min: 20, max: 5000 });
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateForgotPassword(req, res, next) {
  try {
    assertEmailField(req.body, "email", "Email");
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateEmailVerificationToken(req, res, next) {
  try {
    if (!isBlank(req.body.token)) {
      assertStringField(req.body, "token", "Verification token", { min: 20, max: 256 });
      return next();
    }

    assertEmailField(req.body, "email", "Email");
    assertStringField(req.body, "code", "Verification code", { min: 6, max: 12 });
    req.body.code = String(req.body.code).replace(/\D/g, "");
    if (!/^\d{6}$/.test(req.body.code)) fail("Verification code must be 6 digits");
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateResendVerificationEmail(req, res, next) {
  try {
    assertEmailField(req.body, "email", "Email");
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateResetPassword(req, res, next) {
  try {
    assertStringField(req.body, "token", "Reset token", { min: 20, max: 256 });
    assertPasswordField(req.body, "newPassword", "New password");
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateChangePassword(req, res, next) {
  try {
    assertStringField(req.body, "currentPassword", "Current password", { min: 1, max: 128 });
    assertPasswordField(req.body, "newPassword", "New password");
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateManagedUserCreate(req, res, next) {
  try {
    assertStringField(req.body, "name", "Name", { min: 2, max: 120 });
    assertEmailField(req.body, "email", "Email");
    assertPasswordField(req.body, "password", "Password");
    assertEnumField(req.body, "role", USER_ROLE_VALUES, "Role");
    assertObjectIdField(req.body, "organization", "Organization", { required: false });
    assertObjectIdField(req.body, "organizationId", "Organization", { required: false });
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateManagedUserUpdate(req, res, next) {
  try {
    assertStringField(req.body, "name", "Name", { required: false, min: 2, max: 120 });
    assertEnumField(req.body, "role", USER_ROLE_VALUES, "Role", { required: false });
    assertObjectIdField(req.body, "organization", "Organization", { required: false });
    assertObjectIdField(req.body, "organizationId", "Organization", { required: false });
    assertBooleanField(req.body, "isActive", "Active status", { required: false });
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateOrganization(req, res, next) {
  try {
    assertStringField(req.body, "name", "Organization name", { required: req.method === "POST", min: 2, max: 160 });
    assertStringField(req.body, "district", "District", { required: false, max: 120 });
    assertEnumField(req.body, "type", allowedOrganizationTypes, "Organization type", { required: false });
    assertEmailField(req.body, "contactEmail", "Contact email", { required: false });
    if (!isBlank(req.body.phone)) {
      req.body.phone = normalizeString(String(req.body.phone));
      if (!phonePattern.test(req.body.phone)) fail("Phone number must be valid");
    }
    assertStringField(req.body, "address", "Address", { required: false, max: 240 });
    assertEnumField(req.body, "status", allowedOrganizationStatuses, "Organization status", { required: false });
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateCompetency(req, res, next) {
  try {
    const isCreate = req.method === "POST";
    assertStringField(req.body, "code", "Competency code", { required: isCreate, min: 2, max: 40 });
    if (!isBlank(req.body.code)) req.body.code = req.body.code.toUpperCase();
    assertStringField(req.body, "title", "Competency title", { required: isCreate, min: 3, max: 180 });
    assertStringField(req.body, "category", "Category", { required: isCreate, min: 2, max: 120 });
    assertStringField(req.body, "description", "Description", { required: false, max: 5000 });
    assertStringField(req.body, "expectedEvidence", "Expected evidence", { required: false, max: 5000 });
    assertBooleanField(req.body, "isActive", "Active status", { required: false });
    if (req.body.practicalTasks !== undefined) validatePracticalTasks(req.body.practicalTasks);
    if (req.body.theoryQuestions !== undefined) validateTheoryQuestions(req.body.theoryQuestions);
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateBenchmark(req, res, next) {
  try {
    const isCreate = req.method === "POST";
    assertObjectIdField(req.body, "competency", "Competency", { required: isCreate });
    assertNumberField(req.body, "requiredScore", "Required score", { required: isCreate, min: 0, max: 100 });
    assertEnumField(req.body, "level", allowedBenchmarkLevels, "Benchmark level", { required: false });
    assertStringField(req.body, "description", "Description", { required: false, max: 3000 });
    assertBooleanField(req.body, "isActive", "Active status", { required: false });
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateChecklist(req, res, next) {
  try {
    const isCreate = req.method === "POST";
    assertObjectIdField(req.body, "competency", "Competency", { required: isCreate });
    assertObjectIdField(req.body, "practicalTaskId", "Practical task", { required: isCreate });
    assertStringField(req.body, "title", "Checklist title", { required: false, max: 240 });
    if (req.body.items !== undefined || isCreate) validateChecklistItems(req.body.items || []);
    assertBooleanField(req.body, "isActive", "Active status", { required: false });
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateRepositoryTaskReview(req, res, next) {
  try {
    assertObjectIdField(req.body, "competency", "Competency");
    assertObjectIdField(req.body, "practicalTaskId", "Practical task", { required: false });
    assertUrlField(req.body, "githubRepositoryUrl", "GitHub repository URL", { protocols: ["https:"] });
    if (!/^https:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/i.test(req.body.githubRepositoryUrl.replace(/\.git$/i, ""))) {
      fail("GitHub repository URL must point to a GitHub repository");
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateAssessmentSubmission(req, res, next) {
  try {
    const isCreate = req.method === "POST";
    assertObjectIdField(req.body, "competency", "Competency", { required: isCreate });
    assertUrlField(req.body, "githubRepositoryUrl", "GitHub repository URL", { required: false, protocols: ["https:"] });
    if (req.body.githubRepositoryUrl && !/^https:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/i.test(req.body.githubRepositoryUrl.replace(/\.git$/i, ""))) {
      fail("GitHub repository URL must point to a GitHub repository");
    }
    if (req.body.theoryAnswers !== undefined && !Array.isArray(req.body.theoryAnswers)) {
      fail("Theory answers must be a list");
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateAssessmentReview(req, res, next) {
  try {
    assertNumberField(req.body, "practicalTaskScore", "Practical task score", { min: 0, max: 100 });
    assertNumberField(req.body, "quizScore", "Theory score", { min: 0, max: 100 });
    assertStringField(req.body, "assessorComment", "Assessor comment", { required: false, max: 3000 });
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateGraduateProfile(req, res, next) {
  try {
    assertStringField(req.body, "registrationNumber", "Full name", { required: false, max: 120 });
    assertStringField(req.body, "institution", "Organization", { required: false, max: 160 });
    assertStringField(req.body, "program", "Program", { required: false, max: 160 });
    assertStringField(req.body, "specialization", "Specialization", { required: false, max: 160 });
    assertStringField(req.body, "district", "District", { required: false, max: 120 });
    assertStringField(req.body, "sector", "Sector", { required: false, max: 120 });
    assertStringField(req.body, "bio", "Bio", { required: false, max: 1000 });
    assertEnumField(req.body, "gender", allowedGenderValues, "Gender", { required: false });
    assertNumberField(req.body, "graduationYear", "Graduation year", { required: false, min: 2000, max: 2100 });
    if (!isBlank(req.body.phone)) {
      req.body.phone = normalizeString(String(req.body.phone));
      if (!phonePattern.test(req.body.phone)) fail("Phone number must be valid");
    }
    return next();
  } catch (error) {
    return next(error);
  }
}
