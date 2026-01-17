import { env } from "bun";

const toOrigin = (url: string) => {
  try { return new URL(url).origin; } catch { return url; }
};

const nodeEnv = env.NODE_ENV ?? "development";
const isProd = nodeEnv === "production";
const clientUrl = env.CLIENT_URL ?? "http://localhost:5173";
const rpId = env.PASSKEY_RP_ID ?? new URL(clientUrl).hostname;
const baseUrl = env.BETTER_AUTH_URL ?? "http://localhost:3000";
const corsOrigins = (env.CORS_ORIGINS ?? clientUrl).split(",").map(s => s.trim()).filter(Boolean);
const authSecret = env.BETTER_AUTH_SECRET || env.AUTH_SECRET || "dev-insecure-secret-change-me";

export const config = {
  nodeEnv,
  isProd,
  clientUrl,
  rpId,
  baseUrl,
  corsOrigins,
  trustedOrigins: [...new Set([toOrigin(clientUrl), toOrigin(baseUrl), ...corsOrigins.map(toOrigin)])],
  authSecret,
  port: Number(env.PORT ?? 3000),
  isCrossSite: toOrigin(clientUrl) !== toOrigin(baseUrl),
  encryptionSecret: env.ENCRYPTION_SECRET || authSecret,
  openRouterReferer: env.OPENROUTER_REFERER ?? clientUrl,
  embeddingsModelId: env.EMBEDDINGS_MODEL_ID ?? "Xenova/bge-small-en-v1.5",
  embeddingsLocalPath: env.EMBEDDINGS_LOCAL_PATH ?? "./models",
  embeddingsDimensions: Number(env.EMBEDDINGS_DIMENSIONS ?? 384),
  ragTopK: Number(env.RAG_TOP_K ?? 6),
  ragChunkTokens: Number(env.RAG_CHUNK_TOKENS ?? 240),
  ragChunkOverlapTokens: Number(env.RAG_CHUNK_OVERLAP_TOKENS ?? 40),
  ragMinScore: Number(env.RAG_MIN_SCORE ?? 0.5),
  databaseUrl: env.DATABASE_URL ?? "postgresql://openlore:openlore_secret@localhost:5432/openlore",
  registrationEnabled: env.REGISTRATION_ENABLED !== "false",
};
