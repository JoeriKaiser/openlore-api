import { db } from "../../lib/db";
import { lore } from "../../lib/schema";
import { eq, and } from "drizzle-orm";
import { badRequest, json, notFound, readJson } from "../utils/http";
import { getCurrentUser } from "../utils/auth";

type CreateBody = { title: string; content: string };
type UpdateBody = { title?: string; content?: string };

export async function listLore(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const rows = await db.select().from(lore).where(eq(lore.userId, user.id));
  return json(rows);
}

export async function getLore(req: Request, idParam: string) {
  const user = await getCurrentUser(req);
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const id = Number(idParam);
  if (!Number.isFinite(id)) return badRequest("Invalid id");

  const rows = await db
    .select()
    .from(lore)
    .where(and(eq(lore.id, id), eq(lore.userId, user.id)));

  const row = rows[0];
  if (!row) return notFound();
  return json(row);
}

export async function createLore(req: Request) {
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

  if (!body.title || !body.content) {
    return badRequest("title and content are required");
  }

  const [inserted] = await db
    .insert(lore)
    .values({
      title: body.title,
      content: body.content,
      userId: user.id,
    })
    .returning();

  return json(inserted, 201);
}

export async function updateLore(req: Request, idParam: string) {
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

  const payload: Partial<typeof lore.$inferInsert> = {};
  if (body.title !== undefined) payload.title = body.title;
  if (body.content !== undefined) payload.content = body.content;

  if (Object.keys(payload).length === 0) return badRequest("No fields to update");

  const [updated] = await db
    .update(lore)
    .set(payload)
    .where(and(eq(lore.id, id), eq(lore.userId, user.id)))
    .returning();

  if (!updated) return notFound();
  return json(updated);
}

export async function deleteLore(req: Request, idParam: string) {
  const user = await getCurrentUser(req);
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const id = Number(idParam);
  if (!Number.isFinite(id)) return badRequest("Invalid id");

  const [deleted] = await db
    .delete(lore)
    .where(and(eq(lore.id, id), eq(lore.userId, user.id)))
    .returning({ id: lore.id });

  if (!deleted) return notFound();
  return json({ ok: true });
}
