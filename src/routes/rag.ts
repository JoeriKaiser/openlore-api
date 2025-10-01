import { Router } from "../utils/router";
import { reindexRag } from "../controllers/rag";

export function registerRagRoutes(router: Router) {
  router.on("POST", "/api/rag/reindex", ({ req }) => reindexRag(req));
}
