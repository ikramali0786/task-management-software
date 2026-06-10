import { Request, Response, NextFunction } from 'express';
import { JsonWebTokenError } from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError';
import { captureError } from '../config/sentry';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.code ? { code: err.code } : {}),
      ...(err.details ? { details: err.details } : {}),
      data: null,
    });
    return;
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue || {})[0];
    res.status(409).json({
      success: false,
      message: `${field} already exists.`,
      data: null,
    });
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      message: err.message,
      data: null,
    });
    return;
  }

  // JWT errors (expired, malformed, bad signature) → 401, no stack trace needed
  if (err instanceof JsonWebTokenError) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired.' : 'Invalid token.';
    res.status(401).json({ success: false, message, data: null });
    return;
  }

  // Unexpected (non-operational) error — report it to Sentry with request
  // context. ApiError / validation / JWT cases above are expected traffic.
  captureError(err, {
    path: req.path,
    method: req.method,
    userId: (req as any).user?._id?.toString(),
  });

  console.error('[ERROR]', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error.',
    data: null,
  });
};
