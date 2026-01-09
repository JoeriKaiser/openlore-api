import { lore } from "../../lib/schema";
import { createCrudHandlers } from "../utils/crud";
import { enqueueJob } from "../../lib/jobQueue";

const handlers = createCrudHandlers({
  table: lore,
  idField: lore.id,
  userIdField: lore.userId,
  validateCreate: (b) => (!b.title || !b.content ? "title and content are required" : null),
  onAfterCreate: (userId, row) => {
    enqueueJob(userId, "index_lore", { userId, id: row.id, title: row.title, content: row.content }).catch(err =>
      console.error(`[Lore] Failed to enqueue indexing job for lore #${row.id}:`, err)
    );
  },
  onAfterUpdate: (userId, row) => {
    enqueueJob(userId, "delete_chunks", { userId, sourceType: "lore", sourceId: row.id })
      .then(() => enqueueJob(userId, "index_lore", { userId, id: row.id, title: row.title, content: row.content }))
      .catch(err => console.error(`[Lore] Failed to enqueue reindexing job for lore #${row.id}:`, err));
  },
  onAfterDelete: (userId, id) => {
    enqueueJob(userId, "delete_chunks", { userId, sourceType: "lore", sourceId: id }).catch(err =>
      console.error(`[Lore] Failed to enqueue deletion job for lore #${id}:`, err)
    );
  },
});

export const { list: listLore, get: getLore, create: createLore, update: updateLore, delete: deleteLore } = handlers;
