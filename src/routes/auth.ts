import { Router } from "../utils/router";
import { auth } from "../../lib/auth";
import { json, readJson, CORS_HEADERS } from "../utils/http";

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

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

async function withCors(res: Response) {
  const headers = new Headers(res.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export function registerAuthRoutes(router: Router): void {
  router.on("POST", "/api/auth/register", async ({ req }) => {
    try {
      const { email, password, name, image, callbackURL, rememberMe } =
        await readJson<RegisterBody>(req);

      if (!isEmail(email)) return json({ error: "Valid email is required" }, 400);
      if ((password ?? "").length < 8)
        return json({ error: "Password must be at least 8 characters" }, 400);
      if ((name ?? "").trim().length < 2)
        return json({ error: "Name must be at least 2 characters" }, 400);

      const res = await auth.api.signUpEmail({
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

      return withCors(res);
    } catch (e: any) {
      return json({ error: e?.message ?? "Registration failed" }, 400);
    }
  });

  router.on("POST", "/api/auth/login", async ({ req }) => {
    try {
      const { email, password, callbackURL, rememberMe } =
        await readJson<LoginBody>(req);

      if (!isEmail(email)) return json({ error: "Valid email is required" }, 401);
      if (!password) return json({ error: "Password is required" }, 401);

      const res = await auth.api.signInEmail({
        body: {
          email: email.toLowerCase().trim(),
          password,
          callbackURL,
          rememberMe,
        },
        headers: req.headers,
        asResponse: true,
      });

      return withCors(res);
    } catch (e: any) {
      return json({ error: e?.message ?? "Login failed" }, 401);
    }
  });

  router.on("GET", "/api/auth/session", async ({ req }) => {
    try {
      const res = await auth.api.getSession({
        headers: req.headers,
        asResponse: true,
      });
      return withCors(res);
    } catch {
      return json({ user: null, session: null }, 200);
    }
  });

  router.on("POST", "/api/auth/logout", async ({ req }) => {
    try {
      const res = await auth.api.signOut({
        headers: req.headers,
        asResponse: true,
      });
      return withCors(res);
    } catch (e: any) {
      return json({ error: e?.message ?? "Logout failed" }, 500);
    }
  });

  router.on("GET", "/api/auth/*", async ({ req }) => withCors(await auth.handler(req)));
  router.on("POST", "/api/auth/*", async ({ req }) => withCors(await auth.handler(req)));
}
