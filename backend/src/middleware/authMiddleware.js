import { getActiveUserById } from '../services/authService.js';
import { verifyJwt } from '../services/authService.js';
import { AppError, asyncHandler } from '../services/errorService.js';

export const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Authentication token is required', 401);
  }

  if (token.length > 4096) {
    throw new AppError('Authentication token is invalid', 401);
  }

  const payload = verifyJwt(token);
  const user = await getActiveUserById(payload.sub);

  if (user.authProvider !== 'google' && user.isEmailVerified === false) {
    throw new AppError('Please verify your email address before continuing.', 403);
  }

  req.user = user;
  next();
});
