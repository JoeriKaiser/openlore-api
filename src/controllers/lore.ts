import { lore } from "../../lib/schema";
import { createCrudHandlers } from "../utils/crud";
import { indexLoreEntry, deleteChunksForSource } from "../../lib/rag";

const handlers = createCrudHandlers({
  table: lore,
  idField: lore.id,
  userIdField: lore.userId,
  validateCreate: (b) => (!b.title || !b.content ? "title and content are required" : null),
  onAfterCreate: (userId, row) => {
    void indexLoreEntry({ userId, id: row.id, title: row.title, content: row.content });
  },
  onAfterUpdate: (userId, row) => {
    void deleteChunksForSource(userId, "lore", row.id).then(() =>
      indexLoreEntry({ userId, id: row.id, title: row.title, content: row.content })
    );
  },
  onAfterDelete: (userId, id) => {
    void deleteChunksForSource(userId, "lore", id);
  },
});

export const { list: listLore, get: getLore, create: createLore, update: updateLore, delete: deleteLore } = handlers;
