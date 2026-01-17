// backend/src/schemas/auth.ts

import { z } from "zod";

/**
 * Email validation schema - accepts standard email format
 */
const emailSchema = z
  .string()
  .email("Invalid email address")
  .min(1, "Email is required");

/**
 * Password validation - min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
 */
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * Register request: email + password + optional name
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().optional(),
});

export type RegisterRequest = z.infer<typeof registerSchema>;

/**
 * Login request: email + password
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export type LoginRequest = z.infer<typeof loginSchema>;

/**
 * Passkey register start request: name
 */
export const passkeyRegisterStartSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
});

export type PasskeyRegisterStartRequest = z.infer<
  typeof passkeyRegisterStartSchema
>;

/**
 * Helper function to convert Zod validation errors to auth error details
 */
export function zodErrorToDetails(
  error: z.ZodError
): Record<string, string | string[]> {
  const details: Record<string, string | string[]> = {};

  error.issues.forEach((issue) => {
    const path = issue.path.join(".");
    if (!details[path]) {
      details[path] = [];
    }
    if (Array.isArray(details[path])) {
      (details[path] as string[]).push(issue.message);
    }
  });

  return details;
}
