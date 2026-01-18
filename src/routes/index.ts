import { Router } from "../utils/router";
import { registerAuthRoutes } from "./auth";
import { registerCharacterRoutes } from "./characters";
import { registerLoreRoutes } from "./lore";
import { registerAiRoutes } from "./ai";
import { registerRagRoutes } from "./rag";
import { getCorsHeaders } from "../utils/http";

export function registerRoutes(router: Router) {
  // Global OPTIONS preflight handler - must be registered FIRST
  router.on("OPTIONS", "/api/*", ({ req }) => {
    const corsHeaders = getCorsHeaders(req.headers.get("origin"));
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  });

  registerAuthRoutes(router);
  registerCharacterRoutes(router);
  registerLoreRoutes(router);
  registerAiRoutes(router);
  registerRagRoutes(router);
}
