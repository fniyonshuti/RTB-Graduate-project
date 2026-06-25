import express from 'express';
import {
  listCompetencies,
  getCompetency,
  createCompetency,
  updateCompetency,
} from '../controllers/competencyController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { requireFields } from '../middleware/validateMiddleware.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(listCompetencies)
  .post(
    authorize('admin'),
    requireFields('title', 'code', 'category'),
    createCompetency
  );

router
  .route('/:id')
  .get(getCompetency)
  .put(authorize('admin'), updateCompetency);

export default router;
