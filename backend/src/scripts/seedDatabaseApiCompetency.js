import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Competency from '../models/Competency.js';
import Benchmark from '../models/Benchmark.js';

dotenv.config();

const competencyPayload = {
  code: 'ICT-DBAPI-002',
  title: 'Database Design and REST API Integration',
  category: 'Backend Development',
  description:
    'Assesses whether an ICT TVET graduate can design a MongoDB data model and build a secure REST API that performs create, read, update, and delete operations with validation and clear error handling.',
  expectedEvidence:
    'GitHub repository containing Express.js API routes, MongoDB/Mongoose schemas, CRUD controllers or services, validation logic, protected endpoints where required, README setup instructions, and automated API tests.',
  practicalTasks: [
    {
      title: 'Build an ICT Equipment Inventory API',
      instructions:
        'Create a backend API for managing ICT equipment records. The API must allow authorized users to add equipment, view all equipment, view one equipment record, update equipment status, and delete equipment records. Each record should include name, category, serial number, condition, assigned user, and availability status. The project must use MongoDB/Mongoose, Express routes, validation, error handling, and automated API tests.',
      deliverables:
        'GitHub repository URL, Express API source code, MongoDB/Mongoose equipment schema, CRUD endpoints, validation/error handling, README setup guide, and automated test evidence.',
      estimatedMinutes: 120,
      maxScore: 100,
      automatedTestCommand:
        'npm test -- --runInBand tests/instructor-equipment-api.test.js',
      automatedTestFiles: [
        {
          path: 'tests/instructor-equipment-api.test.js',
          content: `import request from "supertest";
import app from "../src/app.js";

describe("ICT equipment inventory API practical task", () => {
  it("creates an equipment record with required fields", async () => {
    const response = await request(app)
      .post("/api/equipment")
      .send({
        name: "Dell Latitude 5420",
        category: "Laptop",
        serialNumber: \`SN-\${Date.now()}\`,
        condition: "Good",
        assignedUser: "ICT Lab",
        status: "available"
      });

    expect([200, 201]).toContain(response.status);
    expect(response.body).toHaveProperty("success", true);
  });

  it("returns validation error when required equipment fields are missing", async () => {
    const response = await request(app)
      .post("/api/equipment")
      .send({
        name: "",
        category: ""
      });

    expect([400, 422]).toContain(response.status);
  });

  it("lists equipment records", async () => {
    const response = await request(app).get("/api/equipment");
    expect([200, 201]).toContain(response.status);
    expect(response.body).toHaveProperty("success", true);
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
        'Which MongoDB/Mongoose concept defines the structure and validation rules for stored documents?',
      type: 'multiple_choice',
      options: ['Schema', 'CSS selector', 'React hook', 'HTML table'],
      correctAnswer: 'Schema',
      expectedAnswer:
        'A Mongoose schema defines document fields, data types, validation rules, and model structure.',
      points: 1,
    },
    {
      question:
        'Which HTTP method is normally used to update an existing equipment record in a REST API?',
      type: 'multiple_choice',
      options: ['PUT or PATCH', 'GET only', 'HEAD only', 'OPTIONS only'],
      correctAnswer: 'PUT or PATCH',
      expectedAnswer:
        'PUT or PATCH is commonly used to update an existing resource in a REST API.',
      points: 1,
    },
  ],
  isActive: true,
};

const benchmarkPayload = {
  requiredScore: 82,
  level: 'intermediate',
  description:
    'RTB-aligned benchmark for backend database and REST API integration. A competent graduate should demonstrate working MongoDB schema design, Express CRUD endpoints, validation, error handling, testing, and documentation.',
  isActive: true,
};

async function seedDatabaseApiCompetency() {
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

seedDatabaseApiCompetency()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
