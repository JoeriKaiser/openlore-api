import { Router } from "../utils/router";
import { registerAuthRoutes } from "./auth";
import { registerCharacterRoutes } from "./characters";
import { registerLoreRoutes } from "./lore";
import { registerAiRoutes } from "./ai";
import { registerRagRoutes } from "./rag";

export function registerRoutes(router: Router) {
  registerAuthRoutes(router);
  registerCharacterRoutes(router);
  registerLoreRoutes(router);
  registerAiRoutes(router);
  registerRagRoutes(router);
}
