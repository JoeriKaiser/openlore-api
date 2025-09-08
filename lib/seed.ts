import { db } from "./db";
import * as schema from "./schema";

await db.insert(schema.characters).values([
  {
    name: "John Doe",
    bio: "test bio",
    createdAt: "2023-01-01T00:00:00.000Z",
    id: 1,
  },
]);

console.log(`Seeding complete.`);
