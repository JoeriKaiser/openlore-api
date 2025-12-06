import { db } from "../../lib/db";
import { eq, and } from "drizzle-orm";
import { badRequest, json, notFound, readJson, unauthorized } from "./http";
import { getCurrentUser } from "./auth";
import type { PgTable } from "drizzle-orm/pg-core";

type CrudConfig<T extends PgTable> = {
  table: T;
  idField: any;
  userIdField: any;
  onAfterCreate?: (userId: string, row: any) => void;
  onAfterUpdate?: (userId: string, row: any) => void;
  onAfterDelete?: (userId: string, id: number) => void;
  validateCreate?: (body: any) => string | null;
};

export function createCrudHandlers<T extends PgTable>(cfg: CrudConfig<T>) {
  const { table, idField, userIdField, onAfterCreate, onAfterUpdate, onAfterDelete, validateCreate } = cfg;

  return {
    async list(req: Request) {
      const user = await getCurrentUser(req);
      if (!user) return unauthorized();
      const rows = await db.select().from(table).where(eq(userIdField, user.id));
      return json(rows);
    },

    async get(req: Request, idParam: string) {
      const user = await getCurrentUser(req);
      if (!user) return unauthorized();
      const id = Number(idParam);
      if (!Number.isFinite(id)) return badRequest("Invalid id");
      const rows = await db.select().from(table).where(and(eq(idField, id), eq(userIdField, user.id)));
      return rows[0] ? json(rows[0]) : notFound();
    },

    async create(req: Request) {
      const user = await getCurrentUser(req);
      if (!user) return unauthorized();
      let body: any;
      try { body = await readJson(req); }
      catch (e: any) { return badRequest(e.message); }
      
      const err = validateCreate?.(body);
      if (err) return badRequest(err);
      
      const [inserted] = await db.insert(table).values({ ...body, userId: user.id }).returning();
      onAfterCreate?.(user.id, inserted);
      return json(inserted, 201);
    },

    async update(req: Request, idParam: string) {
      const user = await getCurrentUser(req);
      if (!user) return unauthorized();
      const id = Number(idParam);
      if (!Number.isFinite(id)) return badRequest("Invalid id");
      
      let body: any;
      try { body = await readJson(req); }
      catch (e: any) { return badRequest(e.message); }
      
      const payload = Object.fromEntries(Object.entries(body).filter(([_, v]) => v !== undefined));
      if (!Object.keys(payload).length) return badRequest("No fields to update");
      
      const [updated] = await db.update(table).set(payload).where(and(eq(idField, id), eq(userIdField, user.id))).returning();
      if (!updated) return notFound();
      onAfterUpdate?.(user.id, updated);
      return json(updated);
    },

    async delete(req: Request, idParam: string) {
      const user = await getCurrentUser(req);
      if (!user) return unauthorized();
      const id = Number(idParam);
      if (!Number.isFinite(id)) return badRequest("Invalid id");
      
      const [deleted] = await db.delete(table).where(and(eq(idField, id), eq(userIdField, user.id))).returning({ id: idField });
      if (!deleted) return notFound();
      onAfterDelete?.(user.id, id);
      return json({ ok: true });
    },
  };
}
