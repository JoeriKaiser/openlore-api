import { Router } from "../utils/router";
import { auth } from "../../lib/auth";
import { badRequest, json, readJson, CORS_HEADERS } from "../utils/http";

type RegisterBody = {
  email: string;
  password: string;
  name: string;
  image?: string;
  callbackURL?: string;
  rememberMe?: boolean;
};

type LoginBody = {
  email: string;
  password: string;
  callbackURL?: string;
  rememberMe?: boolean;
};

function withCors(response: Response): Promise<Response> {
  return (async () => {
    const body = await response.text();
    const headers = new Headers(response.headers);
    Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
    return new Response(body, {
      status: response.status,
      headers,
    });
  })();
}

export function registerAuthRoutes(router: Router) {
  router.on("POST", "/api/auth/register", async ({ req }) => {
    try {
      const body = await readJson<RegisterBody>(req);
      const { email, password, name, image, callbackURL, rememberMe } = body;

      if (!email || !password || !name) {
        return badRequest(
          "Email, password, and name are required for registration."
        );
      }

      const result = await auth.api.signUpEmail({
        body: {
          email,
          password,
          name,
          image,
          callbackURL,
          rememberMe,
        },
        headers: req.headers,
        asResponse: true,
      });

      return withCors(result);
    } catch (error: any) {
      console.error("Registration error:", error);
      return json({ error: error?.message || "Registration failed" }, 400);
    }
  });

  router.on("POST", "/api/auth/login", async ({ req }) => {
    try {
      const body = await readJson<LoginBody>(req);
      const { email, password, callbackURL, rememberMe } = body;

      if (!email || !password) {
        return badRequest("Email and password are required for login.");
      }

      const result = await auth.api.signInEmail({
        body: {
          email,
          password,
          callbackURL,
          rememberMe,
        },
        headers: req.headers,
        asResponse: true,
      });

      return withCors(result);
    } catch (error: any) {
      console.error("Login error:", error);
      return json({ error: error?.message || "Login failed" }, 401);
    }
  });

  // Let Better Auth handle session endpoint so cookie cache/rotation headers are preserved
  router.on("GET", "/api/auth/session", async ({ req }) => {
    console.log("Handling session endpoint", req.headers.get("cookie"));

    const res = await auth.api.getSession({
      headers: req.headers,
      asResponse: true,
    });

    console.log("RESPONSE", res);

    const sessionData = await res.json();

    const setCookieHeader = res.headers.get('set-cookie');
    let token = null;

    if (setCookieHeader) {
      const cookieMatch = setCookieHeader.match(/better-auth\.session_data=([^;]+)/);
      token = cookieMatch ? cookieMatch[1] : null;
    }

    if (!token) {
      const cookieHeader = req.headers.get('cookie');
      if (cookieHeader) {
        const cookieMatch = cookieHeader.match(/better-auth\.session_data=([^;]+)/);
        token = cookieMatch ? cookieMatch[1] : null;
      }
    }

    const responseData = {
      token: token
    };

    return withCors(new Response(JSON.stringify(responseData), {
      status: res.status,
      headers: {
        'Content-Type': 'application/json',
        ...(setCookieHeader ? { 'Set-Cookie': setCookieHeader } : {})
      }
    }));
  });

  router.on("POST", "/api/auth/logout", async ({ req }) => {
    try {
      const result = await auth.api.signOut({
        headers: req.headers,
        asResponse: true,
      });
      return withCors(result);
    } catch (error: any) {
      console.error("Logout error:", error);
      return json({ error: error?.message || "Logout failed" }, 500);
    }
  });

  // Generic handlers for any other better-auth routes
  router.on("GET", "/api/auth/*", async ({ req }) => {
    const res = await auth.handler(req);
    return withCors(res);
  });

  router.on("POST", "/api/auth/*", async ({ req }) => {
    const res = await auth.handler(req);
    return withCors(res);
  });
}