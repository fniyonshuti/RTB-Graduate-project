import {
  createBenchmark as createBenchmarkService,
  deactivateBenchmarkById,
  getBenchmarkById,
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

export const getBenchmark = asyncHandler(async (req, res) => {
  const benchmark = await getBenchmarkById(req.params.id);
  sendSuccess(res, 'Benchmark loaded', benchmark);
});

export const updateBenchmark = asyncHandler(async (req, res) => {
  const benchmark = await updateBenchmarkById(req.params.id, req.body);
  sendSuccess(res, 'Benchmark updated', benchmark);
});

export const deleteBenchmark = asyncHandler(async (req, res) => {
  const benchmark = await deactivateBenchmarkById(req.params.id);
  sendSuccess(res, 'Benchmark deactivated', benchmark);
});
