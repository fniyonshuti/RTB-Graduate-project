import express from 'express';
import {
  changeMyPassword,
  forgotPassword,
  getMe,
  googleLogin,
  login,
  register,
  resetPasswordWithToken,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireFields } from '../middleware/validateMiddleware.js';

const router = express.Router();

router.post('/register', requireFields('name', 'email', 'password'), register);
router.post('/login', requireFields('email', 'password'), login);
router.post('/google', requireFields('credential'), googleLogin);
router.post('/forgot-password', requireFields('email'), forgotPassword);
router.post('/reset-password', requireFields('token', 'newPassword'), resetPasswordWithToken);
router.get('/me', protect, getMe);
router.patch(
  '/change-password',
  protect,
  requireFields('currentPassword', 'newPassword'),
  changeMyPassword,
);

export default router;
