import benchmarkService from '../services/benchmarkService.js';
import { asyncHandler } from '../services/errorService.js';
import { sendSuccess } from '../services/responseService.js';

class BenchmarkController {
  listBenchmarks = asyncHandler(async (req, res) => {
    const benchmarks = await benchmarkService.listBenchmarks(req.query);
    sendSuccess(res, 'Benchmarks loaded', benchmarks);
  });

  createBenchmark = asyncHandler(async (req, res) => {
    const benchmark = await benchmarkService.createBenchmark(req.body, req.user._id);
    sendSuccess(res, 'Benchmark created', benchmark, 201);
  });

  getBenchmark = asyncHandler(async (req, res) => {
    const benchmark = await benchmarkService.getBenchmarkById(req.params.id);
    sendSuccess(res, 'Benchmark loaded', benchmark);
  });

  updateBenchmark = asyncHandler(async (req, res) => {
    const benchmark = await benchmarkService.updateBenchmarkById(req.params.id, req.body);
    sendSuccess(res, 'Benchmark updated', benchmark);
  });

  deleteBenchmark = asyncHandler(async (req, res) => {
    const benchmark = await benchmarkService.deactivateBenchmarkById(req.params.id);
    sendSuccess(res, 'Benchmark deactivated', benchmark);
  });
}

const benchmarkController = new BenchmarkController();

export const listBenchmarks = benchmarkController.listBenchmarks;
export const createBenchmark = benchmarkController.createBenchmark;
export const getBenchmark = benchmarkController.getBenchmark;
export const updateBenchmark = benchmarkController.updateBenchmark;
export const deleteBenchmark = benchmarkController.deleteBenchmark;
export default benchmarkController;