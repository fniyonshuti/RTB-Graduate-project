import {
  changePassword,
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  sanitizeUser,
} from '../services/authService.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const register = asyncHandler(async (req, res) => {
  const result = await registerUser(req.body);
  sendSuccess(res, 'Account registered successfully', result, 201);
});

export const login = asyncHandler(async (req, res) => {
  const result = await loginUser(req.body.email, req.body.password);
  sendSuccess(res, 'Logged in successfully', result);
});

export const getMe = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Current user loaded', sanitizeUser(req.user));
});

export const changeMyPassword = asyncHandler(async (req, res) => {
  const user = await changePassword(
    req.user._id,
    req.body.currentPassword,
    req.body.newPassword,
  );
  sendSuccess(res, 'Password changed successfully', user);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await requestPasswordReset(req.body.email);
  sendSuccess(res, result.message, result);
});

export const resetPasswordWithToken = asyncHandler(async (req, res) => {
  const user = await resetPassword(req.body.token, req.body.newPassword);
  sendSuccess(res, 'Password reset successfully', user);
});
