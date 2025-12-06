import { characters } from "../../lib/schema";
import { createCrudHandlers } from "../utils/crud";
import { indexCharacterBio, deleteChunksForSource } from "../../lib/rag";

const handlers = createCrudHandlers({
  table: characters,
  idField: characters.id,
  userIdField: characters.userId,
  validateCreate: (b) => (!b.name?.trim() ? "name is required" : null),
  onAfterCreate: (userId, row) => {
    void indexCharacterBio({ userId, id: row.id, name: row.name, bio: row.bio });
  },
  onAfterUpdate: (userId, row) => {
    void deleteChunksForSource(userId, "character", row.id).then(() =>
      indexCharacterBio({ userId, id: row.id, name: row.name, bio: row.bio })
    );
  },
  onAfterDelete: (userId, id) => {
    void deleteChunksForSource(userId, "character", id);
  },
});

export const { list: listCharacters, get: getCharacter, create: createCharacter, update: updateCharacter, delete: deleteCharacter } = handlers;
