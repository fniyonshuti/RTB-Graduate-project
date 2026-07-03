import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Competency from '../models/Competency.js';
import Benchmark from '../models/Benchmark.js';

dotenv.config();

const competencyPayload = {
  code: 'ICT-FSWD-001',
  title: 'Full-Stack Web Application Development',
  category: 'Software Development',
  description:
    'Assesses whether an ICT TVET graduate can design, build, test, and document a full-stack web application using a frontend, backend API, database persistence, authentication, validation, and clear user feedback.',
  expectedEvidence:
    'GitHub repository containing frontend source code, backend API source code, MongoDB/Mongoose models, authentication logic, validation, README setup guide, test files, and runnable build/test scripts.',
  practicalTasks: [
    {
      title: 'Build a Graduate Profile Management Module',
      instructions:
        'Create a working full-stack module that allows a graduate to register, log in, view profile details, update profile information, and save the data in MongoDB. The module must include frontend forms, backend API endpoints, JWT-protected routes, validation, and clear success/error messages.',
      deliverables:
        'GitHub repository URL, frontend profile pages, backend authentication/profile endpoints, MongoDB/Mongoose user or profile schema, README setup instructions, and automated test evidence.',
      estimatedMinutes: 120,
      maxScore: 100,
      automatedTestCommand:
        'npm test -- --runInBand tests/instructor-profile-api.test.js',
      automatedTestFiles: [
        {
          path: 'tests/instructor-profile-api.test.js',
          content: `import request from "supertest";
import app from "../src/app.js";

describe("Graduate profile management practical task", () => {
  it("registers a graduate account", async () => {
    const uniqueEmail = \`graduate-\${Date.now()}@example.com\`;
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test Graduate",
        email: uniqueEmail,
        password: "Password123!",
        role: "normal_user"
      });

    expect([200, 201]).toContain(response.status);
    expect(response.body).toHaveProperty("success", true);
  });

  it("rejects access to graduate profile without JWT token", async () => {
    const response = await request(app).get("/api/graduates/me");
    expect([401, 403]).toContain(response.status);
  });

  it("returns validation failure for invalid registration payload", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "",
        email: "invalid-email",
        password: "123",
        role: "normal_user"
      });

    expect([400, 422]).toContain(response.status);
  });
});
`,
        },
      ],
    },
  ],
  theoryQuestions: [
    {
      question:
        'Which mechanism is commonly used to protect backend API routes after a graduate logs in?',
      type: 'multiple_choice',
      options: [
        'JSON Web Token',
        'Plain text password in URL',
        'CSS media query',
        'HTML placeholder',
      ],
      correctAnswer: 'JSON Web Token',
      expectedAnswer:
        'JWT is commonly used to authenticate requests and protect backend routes after login.',
      points: 1,
    },
    {
      question:
        'Why should passwords be hashed before being stored in the database?',
      type: 'multiple_choice',
      options: [
        'To protect user credentials if the database is exposed',
        'To make the frontend load faster',
        'To reduce CSS file size',
        'To automatically create API routes',
      ],
      correctAnswer: 'To protect user credentials if the database is exposed',
      expectedAnswer:
        'Password hashing protects user credentials because original passwords are not stored directly.',
      points: 1,
    },
  ],
  isActive: true,
};

const benchmarkPayload = {
  requiredScore: 85,
  level: 'advanced',
  description:
    'RTB-aligned benchmark for employable full-stack web application development. A graduate should demonstrate working frontend, backend, database, authentication, validation, testing, and documentation evidence.',
  isActive: true,
};

async function seedCompetencyAndBenchmark() {
  await connectDB();

  const competency = await Competency.findOneAndUpdate(
    { code: competencyPayload.code },
    competencyPayload,
    {
      returnDocument: 'after',
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  await Benchmark.updateMany(
    { competency: competency._id },
    { isActive: false },
  );

  const benchmark = await Benchmark.create({
    ...benchmarkPayload,
    competency: competency._id,
  });

  console.log('Seed completed successfully.');
  console.log(`Competency: ${competency.title} (${competency.code})`);
  console.log(`Competency ID: ${competency._id}`);
  console.log(`Benchmark: ${benchmark.requiredScore}% (${benchmark.level})`);
  console.log(`Benchmark ID: ${benchmark._id}`);
}

seedCompetencyAndBenchmark()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
