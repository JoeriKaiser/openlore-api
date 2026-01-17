import { Router } from "../utils/router";
import { auth } from "../../lib/auth";
import { db } from "../../lib/db";
import { user, session as sessionTable } from "../../lib/schema";
import { eq, and } from "drizzle-orm";
import { json, CORS_HEADERS, forbidden } from "../utils/http";
import { config } from "../../lib/env";
import {
  AuthError,
  ValidationError,
  InvalidCredentialsError,
  UserAlreadyExistsError,
  PasskeyError,
  SessionError,
  handleAuthError,
} from "../utils/auth-errors";
import {
  registerSchema,
  loginSchema,
  passkeyRegisterStartSchema,
  zodErrorToDetails,
} from "../schemas/auth";

const withCors = async (res: Response) => {
  const headers = new Headers(res.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
  // Clone the response to avoid body consumption issues
  const clonedBody = res.body ? res.clone().body : null;
  return new Response(clonedBody, { status: res.status, statusText: res.statusText, headers });
};

export function registerAuthRoutes(router: Router) {
  router.on("GET", "/api/auth/session", async ({ req }) => {
    try {
      return withCors(await auth.api.getSession({ headers: req.headers, asResponse: true }));
    } catch (e) {
      console.error("[Auth] Session fetch error:", e);
      return json({ user: null, session: null }, 200);
    }
  });

  router.on("POST", "/api/auth/logout", async ({ req }) => {
    try {
      return withCors(await auth.api.signOut({ headers: req.headers, asResponse: true }));
    } catch (e) {
      return handleAuthError(new SessionError("Failed to logout"));
    }
  });

  router.on("POST", "/api/auth/passkey/register-start", async ({ req }) => {
    // Check if registration is enabled
    if (!config.registrationEnabled) {
      return withCors(json({ error: "Registration is disabled", code: "REGISTRATION_DISABLED" }, 403));
    }

    try {
      const body = await req.json();

      // Validate request body
      const validation = passkeyRegisterStartSchema.safeParse(body);
      if (!validation.success) {
        const details = zodErrorToDetails(validation.error);
        return handleAuthError(new ValidationError(details));
      }

      const { name } = validation.data;
      const userId = crypto.randomUUID();

      // Create anonymous user
      try {
        await db.insert(user).values({
          id: userId,
          name,
          email: `${userId}@anonymous.local`,
          emailVerified: false,
        });
      } catch (e) {
        console.error("[Auth] User creation error:", e);
        return handleAuthError(new PasskeyError("Failed to create user"));
      }

      // Create session with tracking info
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";

      try {
        await db.insert(sessionTable).values({
          id: crypto.randomUUID(),
          token: sessionToken,
          expiresAt,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (e) {
        console.error("[Auth] Session creation error:", e);
        return handleAuthError(new PasskeyError("Failed to create session"));
      }

      // Get session via Better Auth
      const sessionRes = await auth.api.getSession({
        headers: new Headers({
          ...Object.fromEntries(req.headers.entries()),
          cookie: `auth_session=${sessionToken}`,
        }),
      });

      const expiresAtStr = expiresAt.toUTCString();
      return withCors(new Response(JSON.stringify(sessionRes), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `auth_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAtStr}`,
          ...CORS_HEADERS,
        },
      }));
    } catch (e) {
      console.error("[Auth] Passkey register-start error:", e);
      return handleAuthError(new PasskeyError("Failed to start passkey registration"));
    }
  });

  router.on("POST", "/api/auth/passkey/sign-in", async ({ req }) => {
    try {
      const body = await req.json();
      return withCors(await auth.api.signIn.passkey({
        headers: req.headers,
        body,
        asResponse: true,
      }));
    } catch (e: any) {
      return json({ error: e?.message ?? "Login failed" }, 500);
    }
  });

  router.on("POST", "/api/auth/register", async ({ req }) => {
    // Check if registration is enabled
    if (!config.registrationEnabled) {
      return withCors(json({ error: "Registration is disabled", code: "REGISTRATION_DISABLED" }, 403));
    }

    try {
      const body = await req.json();

      // Validate request body
      const validation = registerSchema.safeParse(body);
      if (!validation.success) {
        const details = zodErrorToDetails(validation.error);
        return handleAuthError(new ValidationError(details));
      }

      const { email, password, name } = validation.data;

      // Check if user already exists
      const [existingUser] = await db.select().from(user).where(eq(user.email, email));

      if (existingUser) {
        return handleAuthError(new UserAlreadyExistsError(`User with email ${email} already exists`));
      }

      // Delegate to Better Auth for actual registration
      return withCors(await auth.api.signUpEmail({
        headers: req.headers,
        body: {
          email,
          password,
          name: name || undefined,
        },
        asResponse: true,
      }));
    } catch (e) {
      console.error("[Auth] Register error:", e);
      if (e instanceof AuthError) {
        return handleAuthError(e);
      }
      return handleAuthError(new AuthError("Registration failed"));
    }
  });

  router.on("POST", "/api/auth/login", async ({ req }) => {
    console.log("[Auth] Login attempt from origin:", req.headers.get("origin"));
    try {
      const body = await req.json();

      // Validate request body
      const validation = loginSchema.safeParse(body);
      if (!validation.success) {
        const details = zodErrorToDetails(validation.error);
        return handleAuthError(new ValidationError(details));
      }

      const { email, password } = validation.data;
      console.log("[Auth] Login attempt for email:", email);

      // Verify credentials exist before delegating to Better Auth
      const [existingUser] = await db.select().from(user).where(eq(user.email, email));

      if (!existingUser) {
        return handleAuthError(new InvalidCredentialsError());
      }

      // Delegate to Better Auth for actual login
      const betterAuthResponse = await auth.api.signInEmail({
        headers: req.headers,
        body: {
          email,
          password,
        },
        asResponse: true,
      });

      console.log("[Auth] Better Auth response status:", betterAuthResponse.status);

      // Always wrap Better Auth responses with CORS
      const response = await withCors(betterAuthResponse);
      console.log("[Auth] Response headers:", Object.fromEntries(response.headers.entries()));
      return response;
    } catch (e) {
      console.error("[Auth] Login error:", e);
      if (e instanceof AuthError) {
        return handleAuthError(e);
      }
      return handleAuthError(new InvalidCredentialsError());
    }
  });

  router.on("GET", "/api/auth/*", async ({ req }) => withCors(await auth.handler(req)));
  router.on("POST", "/api/auth/*", async ({ req }) => withCors(await auth.handler(req)));
}
