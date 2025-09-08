import { Router } from "./utils/router";
import { json, CORS_HEADERS, noContent, notFound } from "./utils/http";
import { registerRoutes } from "./routes";

console.log("Starting server initialization...");

const router = new Router();
registerRoutes(router);

const port = Number(Bun.env.PORT ?? 3000);

console.log(`Attempting to start server on port ${port}...`);

try {
  const server = Bun.serve({
    port,
    fetch: async (req) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

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
            ],
          });
        }

        return notFound();
      } catch (err) {
        console.error("Request handling error:", err);
        return json({ error: "Internal Server Error" }, { status: 500 });
      }
    },
    error(error) {
      console.error("Server error:", error);
      return new Response("Server Error", { status: 500 });
    },
  });

  console.log(`✅ OpenLore API successfully started!`);
  console.log(`🚀 Server listening on http://localhost:${server.port}`);
  console.log(`📊 Health check: http://localhost:${server.port}/health`);
} catch (error) {
  console.error("Failed to start server:", error);
  process.exit(1);
}