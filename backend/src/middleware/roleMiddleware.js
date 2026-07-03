import { AppError } from '../utils/errors.js';
import { LEARNER_ROLES, ROLES, SYSTEM_ADMIN_ROLES } from '../constants/roles.js';

function expandAllowedRoles(allowedRoles) {
  return new Set(
    allowedRoles.flatMap((role) => {
      if (role === 'learner') {
        return LEARNER_ROLES;
      }

      if (role === ROLES.ADMIN) {
        return SYSTEM_ADMIN_ROLES;
      }

      return [role];
    }),
  );
}

export function authorize(...allowedRoles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return next(new AppError('Authentication is required', 401));
    }

    if (!expandAllowedRoles(allowedRoles).has(req.user.role)) {
      return next(new AppError('You are not allowed to perform this action', 403));
    }

    return next();
  };
}
