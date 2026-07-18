import express from 'express';
import {
  changeMyPassword,
  forgotPassword,
  getMe,
  googleLogin,
  login,
  register,
  resendVerificationEmail,
  resetPasswordWithToken,
  verifyEmail,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  requireFields,
  validateChangePassword,
  validateEmailVerificationToken,
  validateForgotPassword,
  validateGoogleLogin,
  validateLogin,
  validateRegister,
  validateResendVerificationEmail,
  validateResetPassword,
} from '../middleware/validateMiddleware.js';

const router = express.Router();

router.post('/register', requireFields('name', 'email', 'password'), validateRegister, register);
router.post('/login', requireFields('email', 'password'), validateLogin, login);
router.get('/google', (req, res) => {
  res.status(405).json({
    success: false,
    message: 'Google sign-in uses POST /api/auth/google with a Google credential from the frontend button. Do not open this endpoint directly in the browser.',
    requestId: req.id,
  });
});
router.post('/google', requireFields('credential'), validateGoogleLogin, googleLogin);
router.post('/forgot-password', requireFields('email'), validateForgotPassword, forgotPassword);
router.post('/verify-email', requireFields('token'), validateEmailVerificationToken, verifyEmail);
router.post('/resend-verification', requireFields('email'), validateResendVerificationEmail, resendVerificationEmail);
router.post('/reset-password', requireFields('token', 'newPassword'), validateResetPassword, resetPasswordWithToken);
router.get('/me', protect, getMe);
router.patch(
  '/change-password',
  protect,
  requireFields('currentPassword', 'newPassword'),
  validateChangePassword,
  changeMyPassword,
);

export default router;
