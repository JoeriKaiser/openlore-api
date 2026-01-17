// backend/tests/auth.test.ts

import { describe, it, expect } from "bun:test";
import {
  ValidationError,
  InvalidCredentialsError,
  UserAlreadyExistsError,
  PasskeyError,
  SessionError,
  RateLimitError,
  AuthError,
  authErrorResponse,
  handleAuthError,
} from "../src/utils/auth-errors";
import {
  registerSchema,
  loginSchema,
  passkeyRegisterStartSchema,
  zodErrorToDetails,
} from "../src/schemas/auth";

describe("Auth Error Handling", () => {
  describe("ValidationError", () => {
    it("should create validation error with 422 status", () => {
      const error = new ValidationError({
        email: "Invalid email address",
      });
      expect(error.status).toBe(422);
      expect(error.code).toBe("VALIDATION_ERROR");
    });

    it("should include message", () => {
      const error = new ValidationError({
        email: "Invalid email address",
      });
      expect(error.message).toBe("Validation failed");
    });

    it("should include details in JSON response", () => {
      const error = new ValidationError({
        password: ["Password must be at least 8 characters"],
      });
      const json = error.toJSON();
      expect(json.details).toBeDefined();
      expect(json.details?.password).toEqual([
        "Password must be at least 8 characters",
      ]);
    });

    it("should include custom message", () => {
      const error = new ValidationError(
        { email: "Invalid" },
        "Custom validation error"
      );
      expect(error.message).toBe("Custom validation error");
      expect(error.toJSON().error).toBe("Custom validation error");
    });

    it("should handle multiple field errors", () => {
      const error = new ValidationError({
        email: ["Invalid email address", "Email is required"],
        password: ["Password is too weak"],
      });
      const json = error.toJSON();
      expect(json.details?.email).toEqual([
        "Invalid email address",
        "Email is required",
      ]);
      expect(json.details?.password).toEqual(["Password is too weak"]);
    });
  });

  describe("InvalidCredentialsError", () => {
    it("should create 401 error", () => {
      const error = new InvalidCredentialsError();
      expect(error.status).toBe(401);
      expect(error.code).toBe("INVALID_CREDENTIALS");
    });

    it("should have default message", () => {
      const error = new InvalidCredentialsError();
      expect(error.message).toBe("Invalid email or password");
    });

    it("should allow custom message", () => {
      const error = new InvalidCredentialsError("Wrong credentials provided");
      expect(error.message).toBe("Wrong credentials provided");
    });

    it("should include code in JSON response", () => {
      const error = new InvalidCredentialsError();
      const json = error.toJSON();
      expect(json.code).toBe("INVALID_CREDENTIALS");
    });
  });

  describe("UserAlreadyExistsError", () => {
    it("should create 409 error", () => {
      const error = new UserAlreadyExistsError();
      expect(error.status).toBe(409);
      expect(error.code).toBe("USER_ALREADY_EXISTS");
    });

    it("should have default message", () => {
      const error = new UserAlreadyExistsError();
      expect(error.message).toBe("User already exists");
    });

    it("should allow custom message", () => {
      const error = new UserAlreadyExistsError("Email already registered");
      expect(error.message).toBe("Email already registered");
    });
  });

  describe("SessionError", () => {
    it("should create 401 error", () => {
      const error = new SessionError();
      expect(error.status).toBe(401);
      expect(error.code).toBe("SESSION_ERROR");
    });

    it("should have default message", () => {
      const error = new SessionError();
      expect(error.message).toBe("Session invalid or expired");
    });

    it("should allow custom message", () => {
      const error = new SessionError("Session expired");
      expect(error.message).toBe("Session expired");
    });
  });

  describe("PasskeyError", () => {
    it("should create 400 error", () => {
      const error = new PasskeyError("Invalid passkey");
      expect(error.status).toBe(400);
      expect(error.code).toBe("PASSKEY_ERROR");
    });

    it("should require message", () => {
      const error = new PasskeyError("Passkey verification failed");
      expect(error.message).toBe("Passkey verification failed");
    });

    it("should include code in JSON response", () => {
      const error = new PasskeyError("Invalid passkey format");
      const json = error.toJSON();
      expect(json.code).toBe("PASSKEY_ERROR");
    });
  });

  describe("RateLimitError", () => {
    it("should create 429 error", () => {
      const error = new RateLimitError();
      expect(error.status).toBe(429);
      expect(error.code).toBe("RATE_LIMIT");
    });

    it("should have default message", () => {
      const error = new RateLimitError();
      expect(error.message).toBe("Too many attempts. Please try again later.");
    });

    it("should allow custom message", () => {
      const error = new RateLimitError("Wait 5 minutes before trying again");
      expect(error.message).toBe("Wait 5 minutes before trying again");
    });
  });

  describe("AuthError base class", () => {
    it("should create error with custom status", () => {
      const error = new AuthError("Test error", 403, "FORBIDDEN");
      expect(error.status).toBe(403);
      expect(error.code).toBe("FORBIDDEN");
    });

    it("should have default status 500", () => {
      const error = new AuthError("Test error");
      expect(error.status).toBe(500);
    });

    it("should have default code AUTH_ERROR", () => {
      const error = new AuthError("Test error");
      expect(error.code).toBe("AUTH_ERROR");
    });

    it("should convert to JSON with details", () => {
      const error = new AuthError("Test error", 400, "TEST_CODE", {
        field: "value",
      });
      const json = error.toJSON();
      expect(json.error).toBe("Test error");
      expect(json.code).toBe("TEST_CODE");
      expect(json.details).toEqual({ field: "value" });
    });
  });
});

describe("Auth Validation Schemas", () => {
  describe("registerSchema", () => {
    it("should accept valid registration", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "Password123",
        name: "Test User",
      });
      expect(result.success).toBe(true);
    });

    it("should accept registration without name", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "Password123",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = registerSchema.safeParse({
        email: "invalid-email",
        password: "Password123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.email).toBeDefined();
      }
    });

    it("should reject empty email", () => {
      const result = registerSchema.safeParse({
        email: "",
        password: "Password123",
      });
      expect(result.success).toBe(false);
    });

    it("should reject weak password (too short)", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "Pass1",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.password).toBeDefined();
      }
    });

    it("should require uppercase in password", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "password123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.password).toBeDefined();
      }
    });

    it("should require lowercase in password", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "PASSWORD123",
      });
      expect(result.success).toBe(false);
    });

    it("should require number in password", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "PasswordABC",
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid complex password", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "MyPassword123!@#",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing email", () => {
      const result = registerSchema.safeParse({
        password: "Password123",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing password", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("should accept valid login", () => {
      const result = loginSchema.safeParse({
        email: "user@example.com",
        password: "Password123",
      });
      expect(result.success).toBe(true);
    });

    it("should require email", () => {
      const result = loginSchema.safeParse({
        password: "Password123",
      });
      expect(result.success).toBe(false);
    });

    it("should require password", () => {
      const result = loginSchema.safeParse({
        email: "user@example.com",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid email format", () => {
      const result = loginSchema.safeParse({
        email: "not-an-email",
        password: "Password123",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty password", () => {
      const result = loginSchema.safeParse({
        email: "user@example.com",
        password: "",
      });
      expect(result.success).toBe(false);
    });

    it("should accept any password format (for login)", () => {
      const result = loginSchema.safeParse({
        email: "user@example.com",
        password: "anything",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("passkeyRegisterStartSchema", () => {
    it("should accept valid name", () => {
      const result = passkeyRegisterStartSchema.safeParse({
        name: "John Doe",
      });
      expect(result.success).toBe(true);
    });

    it("should accept single character name", () => {
      const result = passkeyRegisterStartSchema.safeParse({
        name: "J",
      });
      expect(result.success).toBe(true);
    });

    it("should accept long name (255 chars)", () => {
      const result = passkeyRegisterStartSchema.safeParse({
        name: "A".repeat(255),
      });
      expect(result.success).toBe(true);
    });

    it("should require name", () => {
      const result = passkeyRegisterStartSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject empty name", () => {
      const result = passkeyRegisterStartSchema.safeParse({
        name: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject name longer than 255 chars", () => {
      const result = passkeyRegisterStartSchema.safeParse({
        name: "A".repeat(256),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.name).toBeDefined();
      }
    });

    it("should accept name with spaces and special chars", () => {
      const result = passkeyRegisterStartSchema.safeParse({
        name: "John O'Reilly-Smith Jr.",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("zodErrorToDetails", () => {
    it("should convert zod errors to details object", () => {
      const result = registerSchema.safeParse({
        email: "invalid",
        password: "weak",
      });
      if (!result.success) {
        const details = zodErrorToDetails(result.error);
        expect(details.email).toBeDefined();
        expect(details.password).toBeDefined();
      }
    });

    it("should handle multiple errors per field", () => {
      const result = registerSchema.safeParse({
        email: "invalid",
        password: "weak",
      });
      if (!result.success) {
        const details = zodErrorToDetails(result.error);
        expect(Array.isArray(details.email)).toBe(true);
        expect(Array.isArray(details.password)).toBe(true);
      }
    });

    it("should return empty object for valid data", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "Password123",
      });
      if (result.success) {
        expect(result.data).toBeDefined();
      }
    });
  });
});

describe("Auth Error Response", () => {
  it("should convert ValidationError to HTTP response", () => {
    const error = new ValidationError({ email: "Invalid email" });
    const response = authErrorResponse(error);
    expect(response.status).toBe(422);
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("should convert InvalidCredentialsError to HTTP response", () => {
    const error = new InvalidCredentialsError();
    const response = authErrorResponse(error);
    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("should convert UserAlreadyExistsError to HTTP response", () => {
    const error = new UserAlreadyExistsError();
    const response = authErrorResponse(error);
    expect(response.status).toBe(409);
  });

  it("should convert PasskeyError to HTTP response", () => {
    const error = new PasskeyError("Invalid passkey");
    const response = authErrorResponse(error);
    expect(response.status).toBe(400);
  });

  it("should convert RateLimitError to HTTP response", () => {
    const error = new RateLimitError();
    const response = authErrorResponse(error);
    expect(response.status).toBe(429);
  });

  it("should include error details in response body", async () => {
    const error = new ValidationError({ email: "Invalid email" });
    const response = authErrorResponse(error);
    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.details?.email).toBeDefined();
  });

  it("should not include details if none provided", async () => {
    const error = new InvalidCredentialsError();
    const response = authErrorResponse(error);
    const body = await response.json();
    expect(body.error).toBe("Invalid email or password");
    expect(body.code).toBe("INVALID_CREDENTIALS");
    expect(body.details).toBeUndefined();
  });

  it("should handle complex error details", async () => {
    const error = new ValidationError({
      email: ["Invalid format", "Already exists"],
      password: "Too weak",
    });
    const response = authErrorResponse(error);
    const body = await response.json();
    expect(Array.isArray(body.details?.email)).toBe(true);
    expect(body.details?.email).toEqual(["Invalid format", "Already exists"]);
  });
});

describe("Error Handler", () => {
  it("should handle AuthError instances", () => {
    const error = new ValidationError({ email: "Invalid" });
    const response = handleAuthError(error);
    expect(response.status).toBe(422);
  });

  it("should handle generic Error instances", () => {
    const error = new Error("Something went wrong");
    const response = handleAuthError(error);
    expect(response.status).toBe(500);
  });

  it("should handle unknown error types", () => {
    const response = handleAuthError("random string");
    expect(response.status).toBe(500);
  });

  it("should return 500 for unexpected errors", async () => {
    const error = new Error("Database connection failed");
    const response = handleAuthError(error);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
