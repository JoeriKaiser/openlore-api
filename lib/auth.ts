import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { passkey } from "@better-auth/passkey";
import { db } from "./db";
import * as schema from "./schema";
import { config } from "./env";

const cookieConfig = {
  httpOnly: true,
  path: "/",
  sameSite: config.isCrossSite ? "none" : "lax",
  secure: config.isProd || config.isCrossSite,
} as const;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      passkey: schema.passkey,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  plugins: [
    passkey({
      rpName: "OpenLore",
      rpID: config.rpId,
      origin: config.clientUrl,
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  baseURL: config.baseUrl,
  basePath: "/api/auth",
  trustedOrigins: config.trustedOrigins,
  secret: config.authSecret,
  advanced: {
    useSecureCookies: config.isProd || config.isCrossSite,
    cookies: {
      session_token: { attributes: cookieConfig },
      session_data: { attributes: cookieConfig },
    },
    generateId: () => crypto.randomUUID(),
  },
  user: {
    additionalFields: {
      name: {
        type: "string",
        required: false,
        defaultValue: "Anonymous",
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
