import { registerUser, loginUser, sanitizeUser } from '../services/authService.js';
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
