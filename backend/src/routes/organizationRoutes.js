import express from 'express';
import {
  create,
  getOne,
  list,
  listPublic,
  remove,
  update,
} from '../controllers/organizationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { requireFields } from '../middleware/validateMiddleware.js';

const router = express.Router();

router.get('/public', listPublic);

router.use(protect);

router.get('/', authorize('admin', 'org_admin'), list);

router
  .route('/:id')
  .get(authorize('admin', 'org_admin'), getOne)
  .put(authorize('admin'), update)
  .delete(authorize('admin'), remove);

router.post('/', authorize('admin'), requireFields('name'), create);

export default router;
