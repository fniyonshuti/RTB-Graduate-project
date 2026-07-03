import Benchmark from "../models/Benchmark.js";
import Competency from "../models/Competency.js";
import { AppError } from "../utils/errors.js";

export function listBenchmarks(filters = {}) {
  const query = {};

  if (filters.activeOnly === "true") query.isActive = true;
  if (filters.competency) query.competency = filters.competency;

  return Benchmark.find(query)
    .populate("competency", "title code category")
    .sort({ createdAt: -1 });
}

export async function getBenchmarkById(benchmarkId) {
  const benchmark = await Benchmark.findById(benchmarkId).populate(
    "competency",
    "title code category",
  );

  if (!benchmark) {
    throw new AppError("Benchmark was not found", 404);
  }

  return benchmark;
}

export async function createBenchmark(payload, createdBy) {
  const competency = await Competency.findById(payload.competency);

  if (!competency) {
    throw new AppError("Competency was not found", 404);
  }

  if (payload.isActive !== false) {
    await Benchmark.updateMany(
      { competency: payload.competency },
      { isActive: false },
    );
  }

  return Benchmark.create({
    ...payload,
    createdBy,
  });
}

export async function updateBenchmarkById(benchmarkId, payload) {
  const benchmark = await Benchmark.findByIdAndUpdate(benchmarkId, payload, {
    new: true,
    runValidators: true,
  }).populate("competency", "title code category");

  if (!benchmark) {
    throw new AppError("Benchmark was not found", 404);
  }

  return benchmark;
}

export async function deactivateBenchmarkById(benchmarkId) {
  const benchmark = await Benchmark.findByIdAndUpdate(
    benchmarkId,
    { isActive: false },
    { new: true, runValidators: true },
  ).populate("competency", "title code category");

  if (!benchmark) {
    throw new AppError("Benchmark was not found", 404);
  }

  return benchmark;
}
