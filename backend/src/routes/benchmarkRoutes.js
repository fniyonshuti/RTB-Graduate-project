import express from 'express';
import {
  listBenchmarks,
  createBenchmark,
  getBenchmark,
  updateBenchmark,
  deleteBenchmark,
} from '../controllers/benchmarkController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { requireFields } from '../middleware/validateMiddleware.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(listBenchmarks)
  .post(
    authorize('admin'),
    requireFields('competency', 'requiredScore'),
    createBenchmark
  );

router
  .route('/:id')
  .get(getBenchmark)
  .put(authorize('admin'), updateBenchmark)
  .delete(authorize('admin'), deleteBenchmark);

export default router;
