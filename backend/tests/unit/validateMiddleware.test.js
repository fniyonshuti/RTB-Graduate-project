import assert from "node:assert/strict";
import test from "node:test";
import {
  validateAssessmentReview,
  validateAssessmentSubmission,
  validateChecklist,
  validateRegister,
  validateRepositoryTaskReview,
} from "../../src/middleware/validateMiddleware.js";

function runValidator(validator, body, req = {}) {
  let receivedError;
  validator({ body, method: "POST", ...req }, {}, (error) => {
    receivedError = error;
  });
  return receivedError;
}

const validGithubUrl = "https://github.com/fniyonshuti/competra-sample";
const smallZipDataUrl = `data:application/zip;base64,${Buffer.from("a small zip payload").toString("base64")}`;
const oversizedZipDataUrl = `data:application/zip;base64,${Buffer.alloc(11 * 1024 * 1024, 1).toString("base64")}`;

test("register validation rejects invalid email addresses", () => {
  const error = runValidator(validateRegister, {
    name: "Test User",
    email: "invalid-email",
    password: "password123",
  });

  assert.equal(error.statusCode, 400);
  assert.equal(error.message, "Email must be a valid email address");
});

test("assessment review validation rejects scores outside 0 to 100", () => {
  const error = runValidator(validateAssessmentReview, {
    practicalTaskScore: 101,
    quizScore: 80,
  });

  assert.equal(error.statusCode, 400);
  assert.equal(error.message, "Practical task score must not exceed 100");
});

test("checklist validation requires total weight of 100", () => {
  const error = runValidator(validateChecklist, {
    competency: "507f1f77bcf86cd799439011",
    practicalTaskId: "507f1f77bcf86cd799439012",
    items: [
      { title: "Repository runs", weight: 40 },
      { title: "Hidden tests pass", weight: 40 },
    ],
  });

  assert.equal(error.statusCode, 400);
  assert.equal(error.message, "Checklist weight must total 100. Current total is 80.");
});

test("register validation rejects weak passwords", () => {
  const error = runValidator(validateRegister, {
    name: "Test User",
    email: "test@example.com",
    password: "weakpass",
  });

  assert.equal(error.statusCode, 400);
  assert.match(error.message, /uppercase, lowercase, number, special character, and no spaces/);
});

test("register validation accepts strong passwords", () => {
  const error = runValidator(validateRegister, {
    name: "Test User",
    email: "test@example.com",
    password: "StrongPass1!",
    termsAccepted: true,
    privacyPolicyAccepted: true,
  });

  assert.equal(error, undefined);
});

test("repository task review rejects a GitHub URL and an uploaded zip together", () => {
  const error = runValidator(validateRepositoryTaskReview, {
    competency: "507f1f77bcf86cd799439011",
    githubRepositoryUrl: validGithubUrl,
    uploadedProjectZip: { name: "project.zip", dataUrl: smallZipDataUrl },
  });

  assert.equal(error.statusCode, 400);
  assert.match(error.message, /exactly one evidence source/);
});

test("repository task review rejects neither a GitHub URL nor an uploaded zip", () => {
  const error = runValidator(validateRepositoryTaskReview, {
    competency: "507f1f77bcf86cd799439011",
  });

  assert.equal(error.statusCode, 400);
  assert.match(error.message, /exactly one evidence source/);
});

test("repository task review accepts an uploaded project zip alone", () => {
  const error = runValidator(validateRepositoryTaskReview, {
    competency: "507f1f77bcf86cd799439011",
    uploadedProjectZip: { name: "project.zip", dataUrl: smallZipDataUrl },
  });

  assert.equal(error, undefined);
});

test("repository task review rejects an uploaded file that isn't a .zip", () => {
  const error = runValidator(validateRepositoryTaskReview, {
    competency: "507f1f77bcf86cd799439011",
    uploadedProjectZip: { name: "project.tar", dataUrl: smallZipDataUrl },
  });

  assert.equal(error.statusCode, 400);
  assert.match(error.message, /must be a \.zip file/);
});

test("repository task review rejects an uploaded zip over the 10MB limit", () => {
  const error = runValidator(validateRepositoryTaskReview, {
    competency: "507f1f77bcf86cd799439011",
    uploadedProjectZip: { name: "project.zip", dataUrl: oversizedZipDataUrl },
  });

  assert.equal(error.statusCode, 400);
  assert.match(error.message, /exceeds the 10MB limit/);
});

test("assessment submission (create) requires exactly one evidence source", () => {
  const error = runValidator(
    validateAssessmentSubmission,
    { competency: "507f1f77bcf86cd799439011" },
    { method: "POST" },
  );

  assert.equal(error.statusCode, 400);
  assert.match(error.message, /exactly one evidence source/);
});

test("assessment submission (create) accepts an uploaded project zip alone", () => {
  const error = runValidator(
    validateAssessmentSubmission,
    {
      competency: "507f1f77bcf86cd799439011",
      uploadedProjectZip: { name: "project.zip", dataUrl: smallZipDataUrl },
    },
    { method: "POST" },
  );

  assert.equal(error, undefined);
});

test("assessment submission (update) does not require an evidence source", () => {
  const error = runValidator(
    validateAssessmentSubmission,
    {},
    { method: "PUT" },
  );

  assert.equal(error, undefined);
});