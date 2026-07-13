import { AppError } from "../services/errorService.js";

export function notFound(req, res, next) {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
}

export function errorHandler(error, req, res, _next) {
  const statusCode = error.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";

  if (!error.isOperational && statusCode >= 500) {
    console.error({
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      message: error.message,
      stack: error.stack,
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: Object.values(error.errors)
        .map((fieldError) => fieldError.message)
        .join(", "),
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A record with the same unique value already exists",
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid record identifier",
    });
  }

  if (!error.isOperational && req.originalUrl === "/api/auth/google") {
    return res.status(502).json({
      success: false,
      message:
        "Google sign-in failed on the backend. Confirm GOOGLE_CLIENT_ID matches VITE_GOOGLE_CLIENT_ID, JWT_SECRET is set, MongoDB is connected, and the backend has been redeployed.",
      requestId: req.id,
      ...(isProduction ? {} : { error: error.message }),
    });
  }

  return res.status(statusCode).json({
    success: false,
    message: error.isOperational ? error.message : "Internal server error",
    requestId: req.id,
    ...(isProduction ? {} : { error: error.message }),
  });
}
