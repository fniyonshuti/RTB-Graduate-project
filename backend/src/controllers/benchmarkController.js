import Benchmark from '../models/Benchmark.js';
import Competency from '../models/Competency.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const listBenchmarks = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.activeOnly === 'true') query.isActive = true;
  if (req.query.competency) query.competency = req.query.competency;

  const benchmarks = await Benchmark.find(query)
    .populate('competency', 'title code category')
    .sort({ createdAt: -1 });

  sendSuccess(res, 'Benchmarks loaded', benchmarks);
});

export const createBenchmark = asyncHandler(async (req, res) => {
  const competency = await Competency.findById(req.body.competency);

  if (!competency) {
    throw new AppError('Competency was not found', 404);
  }

  if (req.body.isActive !== false) {
    await Benchmark.updateMany(
      { competency: req.body.competency },
      { isActive: false }
    );
  }

  const benchmark = await Benchmark.create({
    ...req.body,
    createdBy: req.user._id,
  });

  sendSuccess(res, 'Benchmark created', benchmark, 201);
});

export const updateBenchmark = asyncHandler(async (req, res) => {
  const benchmark = await Benchmark.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate('competency', 'title code category');

  if (!benchmark) {
    throw new AppError('Benchmark was not found', 404);
  }

  sendSuccess(res, 'Benchmark updated', benchmark);
});
