import { db } from "../../lib/db";
import { characters } from "../../lib/schema";
import { eq, and } from "drizzle-orm";
import { badRequest, json, notFound, readJson } from "../utils/http";
import { getCurrentUser } from "../utils/auth";

type CreateBody = { name: string; bio?: string | null };
type UpdateBody = { name?: string; bio?: string | null };

export async function listCharacters(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const rows = await db
    .select()
    .from(characters)
    .where(eq(characters.userId, user.id));

  return json(rows);
}

export async function getCharacter(req: Request, idParam: string) {
  const user = await getCurrentUser(req);
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return badRequest("Invalid id");
  }

  const rows = await db
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), eq(characters.userId, user.id)));

  const row = rows[0];
  if (!row) {
    return notFound();
  }

  return json(row);
}

export async function createCharacter(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: CreateBody;
  try {
    body = await readJson<CreateBody>(req);
  } catch (e: any) {
    return badRequest(e?.message ?? "Invalid JSON");
  }

  if (!body.name || body.name.trim().length === 0) {
    return badRequest("name is required");
  }

  try {
    const [inserted] = await db
      .insert(characters)
      .values({
        name: body.name.trim(),
        bio: body.bio ?? null,
        userId: user.id
      })
      .returning();
    return json(inserted, 201);
  } catch (dbError) {
    console.error("❌ Database error:", dbError);
    return badRequest("Database error occurred");
  }
}

export async function updateCharacter(req: Request, idParam: string) {
  const user = await getCurrentUser(req);
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const id = Number(idParam);
  if (!Number.isFinite(id)) return badRequest("Invalid id");

  let body: UpdateBody;
  try {
    body = await readJson<UpdateBody>(req);
  } catch (e: any) {
    return badRequest(e?.message ?? "Invalid JSON");
  }

  const payload: Partial<typeof characters.$inferInsert> = {};
  if (body.name !== undefined) payload.name = body.name;
  if (body.bio !== undefined) payload.bio = body.bio;

  if (Object.keys(payload).length === 0) {
    return badRequest("No fields to update");
  }

  const [updated] = await db
    .update(characters)
    .set(payload)
    .where(and(eq(characters.id, id), eq(characters.userId, user.id)))
    .returning();

  if (!updated) return notFound();
  return json(updated);
}

export async function deleteCharacter(req: Request, idParam: string) {
  const user = await getCurrentUser(req);
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const id = Number(idParam);
  if (!Number.isFinite(id)) return badRequest("Invalid id");

  const [deleted] = await db
    .delete(characters)
    .where(and(eq(characters.id, id), eq(characters.userId, user.id)))
    .returning({ id: characters.id });

  if (!deleted) return notFound();
  return json({ ok: true });
}