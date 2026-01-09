import { characters } from "../../lib/schema";
import { createCrudHandlers } from "../utils/crud";
import { enqueueJob } from "../../lib/jobQueue";

const handlers = createCrudHandlers({
  table: characters,
  idField: characters.id,
  userIdField: characters.userId,
  validateCreate: (b) => (!b.name?.trim() ? "name is required" : null),
  onAfterCreate: (userId, row) => {
    enqueueJob(userId, "index_character", { userId, id: row.id, name: row.name, bio: row.bio }).catch(err =>
      console.error(`[Characters] Failed to enqueue indexing job for character #${row.id}:`, err)
    );
  },
  onAfterUpdate: (userId, row) => {
    enqueueJob(userId, "delete_chunks", { userId, sourceType: "character", sourceId: row.id })
      .then(() => enqueueJob(userId, "index_character", { userId, id: row.id, name: row.name, bio: row.bio }))
      .catch(err => console.error(`[Characters] Failed to enqueue reindexing job for character #${row.id}:`, err));
  },
  onAfterDelete: (userId, id) => {
    enqueueJob(userId, "delete_chunks", { userId, sourceType: "character", sourceId: id }).catch(err =>
      console.error(`[Characters] Failed to enqueue deletion job for character #${id}:`, err)
    );
  },
});

export const { list: listCharacters, get: getCharacter, create: createCharacter, update: updateCharacter, delete: deleteCharacter } = handlers;
