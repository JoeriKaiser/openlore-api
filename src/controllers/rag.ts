import { getCurrentUser } from "../utils/auth";
import { json } from "../utils/http";
import { reindexAllForUser } from "../../lib/rag";

export async function reindexRag(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  try {
    await reindexAllForUser(user.id);
    return json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Reindex failed";
    return json({ error: "Reindex failed", details: msg }, 500);
  }
}
