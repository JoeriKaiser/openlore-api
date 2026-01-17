// backend/src/utils/auth-errors.ts
import { json } from "./http";

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  error: string;
  details?: Record<string, string | string[]>;
  code?: string;
}

/**
 * Custom auth error class with HTTP status
 */
export class AuthError extends Error {
  constructor(
    public message: string,
    public status: number = 500,
    public code: string = "AUTH_ERROR",
    public details?: Record<string, string | string[]>
  ) {
    super(message);
    this.name = "AuthError";
  }

  toJSON(): ErrorResponse {
    return {
      error: this.message,
      code: this.code,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Validation error - malformed request body (422)
 */
export class ValidationError extends AuthError {
  constructor(details: Record<string, string | string[]>, message = "Validation failed") {
    super(message, 422, "VALIDATION_ERROR", details);
  }
}

/**
 * Invalid credentials error (401)
 */
export class InvalidCredentialsError extends AuthError {
  constructor(message = "Invalid email or password") {
    super(message, 401, "INVALID_CREDENTIALS");
  }
}

/**
 * User already exists error (409)
 */
export class UserAlreadyExistsError extends AuthError {
  constructor(message = "User already exists") {
    super(message, 409, "USER_ALREADY_EXISTS");
  }
}

/**
 * Session error (401)
 */
export class SessionError extends AuthError {
  constructor(message = "Session invalid or expired") {
    super(message, 401, "SESSION_ERROR");
  }
}

/**
 * Passkey error (400)
 */
export class PasskeyError extends AuthError {
  constructor(message: string) {
    super(message, 400, "PASSKEY_ERROR");
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AuthError {
  constructor(message = "Too many attempts. Please try again later.") {
    super(message, 429, "RATE_LIMIT");
  }
}

/**
 * Convert AuthError to HTTP response with CORS headers
 */
export function authErrorResponse(error: AuthError): Response {
  return json(error.toJSON(), error.status);
}

/**
 * Handle any error in auth context - converts to appropriate response
 */
export function handleAuthError(error: unknown): Response {
  console.error("[Auth Error]", error);

  // Already an AuthError
  if (error instanceof AuthError) {
    return authErrorResponse(error);
  }

  // Unexpected error - return generic 500
  if (error instanceof Error) {
    const authError = new AuthError(
      "An unexpected error occurred",
      500,
      "INTERNAL_SERVER_ERROR"
    );
    return authErrorResponse(authError);
  }

  const authError = new AuthError(
    "An unexpected error occurred",
    500,
    "INTERNAL_SERVER_ERROR"
  );
  return authErrorResponse(authError);
}
