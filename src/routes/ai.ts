import { Router } from "../utils/router";
import {
  setOpenRouterKey,
  getOpenRouterKeyStatus,
  deleteOpenRouterKey,
  listModels,
  chatStream,
  listChats,
  getChatMessages,
  updateChat,
  deleteChat,
} from "../controllers/ai";

export function registerAiRoutes(router: Router) {
  router.on("POST", "/api/ai/providers/openrouter/key", ({ req }) => setOpenRouterKey(req));
  router.on("GET", "/api/ai/providers/openrouter/key", ({ req }) => getOpenRouterKeyStatus(req));
  router.on("DELETE", "/api/ai/providers/openrouter/key", ({ req }) => deleteOpenRouterKey(req));

  router.on("GET", "/api/ai/models", ({ req }) => listModels(req));

  router.on("POST", "/api/chat/stream", ({ req }) => chatStream(req));

  router.on("GET", "/api/chats", ({ req }) => listChats(req));
  router.on("GET", "/api/chats/:id/messages", ({ req, params }) =>
    getChatMessages(req, params.id as string)
  );
  router.on("PATCH", "/api/chats/:id", ({ req, params }) => updateChat(req, params.id as string));
  router.on("DELETE", "/api/chats/:id", ({ req, params }) => deleteChat(req, params.id as string));
}
