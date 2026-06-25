import User from '../models/User.js';
import { verifyJwt } from '../utils/jwt.js';
import { AppError, asyncHandler } from '../utils/errors.js';

export const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Authentication token is required', 401);
  }

  const payload = verifyJwt(token);
  const user = await User.findById(payload.sub);

  if (!user || !user.isActive) {
    throw new AppError('User account is not available', 401);
  }

  req.user = user;
  next();
});
