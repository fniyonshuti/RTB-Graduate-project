import {
  createBenchmark as createBenchmarkService,
  listBenchmarks as listBenchmarksService,
  updateBenchmarkById,
} from '../services/benchmarkService.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const listBenchmarks = asyncHandler(async (req, res) => {
  const benchmarks = await listBenchmarksService(req.query);
  sendSuccess(res, 'Benchmarks loaded', benchmarks);
});

export const createBenchmark = asyncHandler(async (req, res) => {
  const benchmark = await createBenchmarkService(req.body, req.user._id);
  sendSuccess(res, 'Benchmark created', benchmark, 201);
});

export const updateBenchmark = asyncHandler(async (req, res) => {
  const benchmark = await updateBenchmarkById(req.params.id, req.body);
  sendSuccess(res, 'Benchmark updated', benchmark);
});
