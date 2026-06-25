import express from 'express';
import {
  listBenchmarks,
  createBenchmark,
  updateBenchmark,
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

router.put('/:id', authorize('admin'), updateBenchmark);

export default router;
