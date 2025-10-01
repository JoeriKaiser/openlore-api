import { Router } from "./utils/router";
import { json, CORS_HEADERS, noContent, notFound } from "./utils/http";
import { registerRoutes } from "./routes";
import { config } from "../lib/env";

const router = new Router();
registerRoutes(router);

const port = config.port;

try {
  const server = Bun.serve({
    port,
    fetch: async (req) => {
      if (req.method === "OPTIONS") {
        return noContent({ headers: CORS_HEADERS });
      }

      try {
        const res = await router.handle(req);
        if (res) return res;

        const url = new URL(req.url);

        if (url.pathname === "/health") {
          return json({ ok: true, status: "healthy" });
        }

        if (url.pathname === "/") {
          return json({
            name: "OpenLore API",
            version: "0.1.0",
            endpoints: [
              "GET /health",
              "GET /api/characters",
              "POST /api/characters",
              "GET /api/characters/:id",
              "PATCH /api/characters/:id",
              "DELETE /api/characters/:id",
              "GET /api/lore",
              "POST /api/lore",
              "GET /api/lore/:id",
              "PATCH /api/lore/:id",
              "DELETE /api/lore/:id",
              "POST /api/auth/register",
              "POST /api/auth/login",
              "GET /api/auth/session",
              "POST /api/auth/logout",
              "POST /api/ai/providers/openrouter/key",
              "GET /api/ai/providers/openrouter/key",
              "DELETE /api/ai/providers/openrouter/key",
              "GET /api/ai/models",
              "POST /api/chat/stream",
              "GET /api/chats",
              "GET /api/chats/:id/messages",
              "PATCH /api/chats/:id",
              "DELETE /api/chats/:id",
              "POST /api/rag/reindex",
            ],
          });
        }

        return notFound();
      } catch {
        return json({ error: "Internal Server Error" }, { status: 500 });
      }
    },
    error() {
      return new Response("Server Error", { status: 500 });
    },
  });

  console.log(`OpenLore API listening on http://localhost:${server.port}`);
} catch (error) {
  console.error("Failed to start server:", error);
  process.exit(1);
}
