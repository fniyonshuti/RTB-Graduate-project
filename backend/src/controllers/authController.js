import authService from '../services/authService.js';
import { asyncHandler } from '../services/errorService.js';
import { sendSuccess } from '../services/responseService.js';

class AuthController {
  register = asyncHandler(async (req, res) => {
    const result = await authService.registerUser(req.body);
    sendSuccess(res, 'Account registered successfully', result, 201);
  });

  login = asyncHandler(async (req, res) => {
    const result = await authService.loginUser(req.body.email, req.body.password);
    sendSuccess(res, 'Logged in successfully', result);
  });

  getMe = asyncHandler(async (req, res) => {
    sendSuccess(res, 'Current user loaded', authService.sanitizeUser(req.user));
  });

  changeMyPassword = asyncHandler(async (req, res) => {
    const user = await authService.changePassword(
      req.user._id,
      req.body.currentPassword,
      req.body.newPassword,
    );
    sendSuccess(res, 'Password changed successfully', user);
  });

  forgotPassword = asyncHandler(async (req, res) => {
    const result = await authService.requestPasswordReset(req.body.email);
    sendSuccess(res, result.message, result);
  });

  resetPasswordWithToken = asyncHandler(async (req, res) => {
    const user = await authService.resetPassword(req.body.token, req.body.newPassword);
    sendSuccess(res, 'Password reset successfully', user);
  });
}

const authController = new AuthController();

export const register = authController.register;
export const login = authController.login;
export const getMe = authController.getMe;
export const changeMyPassword = authController.changeMyPassword;
export const forgotPassword = authController.forgotPassword;
export const resetPasswordWithToken = authController.resetPasswordWithToken;
export default authController;