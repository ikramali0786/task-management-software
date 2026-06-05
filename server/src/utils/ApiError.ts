export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  /** Optional machine-readable error code (e.g. 'PLAN_LIMIT') for the client. */
  code?: string;
  /** Optional structured details (e.g. { feature, limit, plan }). */
  details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    options: { isOperational?: boolean; code?: string; details?: Record<string, unknown> } = {}
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = options.isOperational ?? true;
    this.code = options.code;
    this.details = options.details;
    Object.setPrototypeOf(this, ApiError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
