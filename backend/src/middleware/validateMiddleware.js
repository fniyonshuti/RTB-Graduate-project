import { AppError } from '../utils/errors.js';

export function requireFields(...fields) {
  return function fieldValidator(req, res, next) {
    const missingField = fields.find((field) => {
      const value = req.body[field];
      return value === undefined || value === null || value === '';
    });

    if (missingField) {
      return next(new AppError(`${missingField} is required`, 400));
    }

    return next();
  };
}
