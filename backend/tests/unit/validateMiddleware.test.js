import assert from "node:assert/strict";
import test from "node:test";
import {
  validateAssessmentReview,
  validateChecklist,
  validateRegister,
} from "../../src/middleware/validateMiddleware.js";

function runValidator(validator, body) {
  let receivedError;
  validator({ body }, {}, (error) => {
    receivedError = error;
  });
  return receivedError;
}

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
  });

  assert.equal(error, undefined);
});