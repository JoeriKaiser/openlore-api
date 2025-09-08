import { Router } from "../utils/router";
import {
  listLore,
  getLore,
  createLore,
  updateLore,
  deleteLore,
} from "../controllers/lore";

export function registerLoreRoutes(router: Router) {
  router.on("GET", "/api/lore", ({ req }) => listLore(req));
  router.on("GET", "/api/lore/:id", ({ req, params }) => getLore(req, params.id as string));
  router.on("POST", "/api/lore", ({ req }) => createLore(req));
  router.on("PATCH", "/api/lore/:id", ({ req, params }) =>
    updateLore(req, params.id as string)
  );
  router.on("DELETE", "/api/lore/:id", ({ req, params }) => deleteLore(req, params.id as string));
}