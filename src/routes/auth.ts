import { Router } from "../utils/router";
import { auth } from "../../lib/auth";
import { json, readJson, CORS_HEADERS } from "../utils/http";

interface RegisterBody {
  email: string;
  password: string;
  name: string;
  image?: string;
  callbackURL?: string;
  rememberMe?: boolean;
}

interface LoginBody {
  email: string;
  password: string;
  callbackURL?: string;
  rememberMe?: boolean;
}

interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionData {
  user?: User & {
    firstName?: string;
    username?: string;
    avatar?: string;
  };
  session?: {
    session?: {
      expiresAt: string;
      token: string;
      createdAt: string;
      updatedAt: string;
      ipAddress: string;
      userAgent: string;
      userId: string;
      id: string;
    };
    user?: {
      name: string;
      email: string;
      emailVerified: boolean;
      image?: string | null;
      createdAt: string;
      updatedAt: string;
      id: string;
    };
  };
}

interface SessionResponse {
  user: User | null;
  token: string | null;
  session: { active: boolean };
}

async function withCors(response: Response): Promise<Response> {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function extractTokenFromCookies(cookieHeader?: string | null): string | null {
  if (!cookieHeader) return null;
  const cookieMatch = cookieHeader.match(/better-auth\.session_data=([^;]+)/);
  const token = cookieMatch?.[1];
  return token && token.length > 10 ? token : null;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePassword(password: string): boolean {
  return password.length >= 8;
}

function validateName(name: string): boolean {
  return name.trim().length >= 2;
}

function createAuthError(message: string, status: number = 400): Response {
  return json(
    {
      error: message,
      timestamp: new Date().toISOString(),
    },
    status,
  );
}

function normalizeUserData(
  sessionData: SessionData | null | undefined,
): User | null {
  if (!sessionData) return null;

  const user = sessionData.session?.user || sessionData.user;

  if (!user?.id || !user.email) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: Boolean(user.emailVerified),
    image: user.image ?? undefined,
    createdAt: user.createdAt || new Date().toISOString(),
    updatedAt: user.updatedAt || new Date().toISOString(),
  };
}

export function registerAuthRoutes(router: Router): void {
  router.on("POST", "/api/auth/register", async ({ req }) => {
    try {
      const { email, password, name, image, callbackURL, rememberMe } =
        await readJson<RegisterBody>(req);

      if (!validateEmail(email)) {
        return createAuthError("Valid email is required");
      }
      if (!validatePassword(password)) {
        return createAuthError("Password must be at least 8 characters");
      }
      if (!validateName(name)) {
        return createAuthError("Name must be at least 2 characters");
      }

      const result = await auth.api.signUpEmail({
        body: {
          email: email.toLowerCase().trim(),
          password,
          name: name.trim(),
          image,
          callbackURL,
          rememberMe,
        },
        headers: req.headers,
        asResponse: true,
      });

      return withCors(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Registration failed";
      return createAuthError(message, 400);
    }
  });

  router.on("POST", "/api/auth/login", async ({ req }) => {
    try {
      const { email, password, callbackURL, rememberMe } =
        await readJson<LoginBody>(req);

      if (!validateEmail(email)) {
        return createAuthError("Valid email is required", 401);
      }
      if (!password) {
        return createAuthError("Password is required", 401);
      }

      const result = await auth.api.signInEmail({
        body: {
          email: email.toLowerCase().trim(),
          password,
          callbackURL,
          rememberMe,
        },
        headers: req.headers,
        asResponse: true,
      });

      return withCors(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      return createAuthError(message, 401);
    }
  });

  router.on("GET", "/api/auth/session", async ({ req }) => {
    try {
      const res = await auth.api.getSession({
        headers: req.headers,
        asResponse: true,
      });

      const token =
        extractTokenFromCookies(res.headers.get("set-cookie")) ||
        extractTokenFromCookies(req.headers.get("cookie"));

      let user: User | null = null;

      const responseData: SessionResponse = {
        user,
        token,
        session: { active: Boolean(token) },
      };

      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      const setCookieHeader = res.headers.get("set-cookie");
      if (setCookieHeader) {
        headers.set("Set-Cookie", setCookieHeader);
      }

      return withCors(
        new Response(JSON.stringify(responseData), {
          status: res.status,
          headers,
        }),
      );
    } catch (error) {
      const responseData: SessionResponse = {
        user: null,
        token: null,
        session: { active: false },
      };
      return withCors(
        new Response(JSON.stringify(responseData), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
  });

  router.on("POST", "/api/auth/logout", async ({ req }) => {
    try {
      const result = await auth.api.signOut({
        headers: req.headers,
        asResponse: true,
      });
      return withCors(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Logout failed";
      return createAuthError(message, 500);
    }
  });

  const handleGenericAuth = async ({
    req,
  }: {
    req: Request;
  }): Promise<Response> => {
    try {
      return withCors(await auth.handler(req));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Authentication failed";
      return withCors(createAuthError(message, 500));
    }
  };

  router.on("GET", "/api/auth/*", handleGenericAuth);
  router.on("POST", "/api/auth/*", handleGenericAuth);
}
