import { Router } from "../utils/router";
import {
  listCharacters,
  getCharacter,
  createCharacter,
  updateCharacter,
  deleteCharacter,
} from "../controllers/characters";

export function registerCharacterRoutes(router: Router) {
  router.on("GET", "/api/characters", ({ req }) => listCharacters(req));
  router.on("GET", "/api/characters/:id", ({ req, params }) =>
    getCharacter(req, params.id as string)
  );
  router.on("POST", "/api/characters", ({ req }) => createCharacter(req));
  router.on("PATCH", "/api/characters/:id", ({ req, params }) =>
    updateCharacter(req, params.id as string)
  );
  router.on("DELETE", "/api/characters/:id", ({ req, params }) =>
    deleteCharacter(req, params.id as string)
  );
}