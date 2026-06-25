import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireFields } from '../middleware/validateMiddleware.js';

const router = express.Router();

router.post('/register', requireFields('name', 'email', 'password'), register);
router.post('/login', requireFields('email', 'password'), login);
router.get('/me', protect, getMe);

export default router;
