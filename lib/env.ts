import { env } from "bun";

function toOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

const nodeEnv = env.NODE_ENV ?? "development";
const isProd = nodeEnv === "production";

const clientUrl = env.CLIENT_URL ?? "http://localhost:5173";
const baseUrl = env.BETTER_AUTH_URL ?? "http://localhost:3000";
const corsOrigins = (env.CORS_ORIGINS ?? clientUrl)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const trustedOrigins = Array.from(
  new Set([toOrigin(clientUrl), toOrigin(baseUrl), ...corsOrigins.map(toOrigin)])
);

const authSecret =
  env.BETTER_AUTH_SECRET || env.AUTH_SECRET || "dev-insecure-secret-change-me";

const port = Number(env.PORT ?? 3000);

const encryptionSecret = env.ENCRYPTION_SECRET || authSecret;

const openRouterReferer = env.OPENROUTER_REFERER ?? clientUrl;

const embeddingsModelId =
  env.EMBEDDINGS_MODEL_ID ?? "Xenova/bge-small-en-v1.5";
const embeddingsLocalPath = env.EMBEDDINGS_LOCAL_PATH ?? "./models";

const ragTopK = Number(env.RAG_TOP_K ?? 6);
const ragChunkTokens = Number(env.RAG_CHUNK_TOKENS ?? 240);
const ragChunkOverlapTokens = Number(env.RAG_CHUNK_OVERLAP_TOKENS ?? 40);

export const config = {
  nodeEnv,
  isProd,
  clientUrl,
  baseUrl,
  corsOrigins,
  trustedOrigins,
  authSecret,
  port,
  isCrossSite: toOrigin(clientUrl) !== toOrigin(baseUrl),
  encryptionSecret,
  openRouterReferer,
  embeddingsModelId,
  embeddingsLocalPath,
  ragTopK,
  ragChunkTokens,
  ragChunkOverlapTokens
};
