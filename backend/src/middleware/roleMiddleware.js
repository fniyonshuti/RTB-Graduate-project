import { AppError } from '../utils/errors.js';

export function authorize(...allowedRoles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return next(new AppError('Authentication is required', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('You are not allowed to perform this action', 403));
    }

    return next();
  };
}
