import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./schema";
import { config } from "./env";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
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
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  baseURL: config.baseUrl,
  basePath: "/api/auth",
  trustedOrigins: config.trustedOrigins,
  secret: config.authSecret,
  advanced: {
    useSecureCookies: config.isProd || config.isCrossSite,
    cookies: {
      session_token: {
        attributes: {
          httpOnly: true,
          path: "/",
          sameSite: config.isCrossSite ? "none" : "lax",
          secure: config.isProd || config.isCrossSite,
        },
      },
      session_data: {
        attributes: {
          httpOnly: true,
          path: "/",
          sameSite: config.isCrossSite ? "none" : "lax",
          secure: config.isProd || config.isCrossSite,
        },
      },
    },
    generateId: () => crypto.randomUUID(),
  },
  security: {
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
