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
router.get('/google', (req, res) => {
  res.status(405).json({
    success: false,
    message: 'Google sign-in uses POST /api/auth/google with a Google credential from the frontend button. Do not open this endpoint directly in the browser.',
    requestId: req.id,
  });
});
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
