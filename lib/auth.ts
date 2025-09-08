import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./schema";

const isDev = process.env.NODE_ENV !== "production";

const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

function getOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

const isCrossSite = getOrigin(clientUrl) !== getOrigin(baseURL);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  },

  trustedOrigins: [clientUrl, baseURL],

  secret:
    process.env.BETTER_AUTH_SECRET || "dev-insecure-secret-change-me",

  baseURL,

  advanced: {
    cookies: {
      session_token: {
        attributes: {
          httpOnly: true,
          path: "/",
          sameSite: isCrossSite ? "none" : "lax",
          secure: !isDev, // must be true in production (HTTPS)
        },
      },
    },
    generateId: () => crypto.randomUUID(),
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;