import express from 'express';
import {
  listCompetencies,
  getCompetency,
  createCompetency,
  updateCompetency,
  deleteCompetency,
} from '../controllers/competencyController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { requireFields, validateCompetency } from '../middleware/validateMiddleware.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(listCompetencies)
  .post(
    authorize('admin'),
    requireFields('title', 'code', 'category'),
    validateCompetency,
    createCompetency
  );

router
  .route('/:id')
  .get(getCompetency)
  .put(authorize('admin'), validateCompetency, updateCompetency)
  .delete(authorize('admin'), deleteCompetency);

export default router;
