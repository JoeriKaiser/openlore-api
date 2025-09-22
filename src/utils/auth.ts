import { auth } from "../../lib/auth";
import { json } from "./http";

export async function getSession(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });
    return session;
  } catch {
    return null;
  }
}

export async function getCurrentUser(req: Request) {
  const session = await getSession(req);
  return session?.user ?? null;
}

export function requireAuth() {
  return async (req: Request): Promise<Response | null> => {
    const session = await getSession(req);
    if (!session) {
      return json({ error: "Unauthorized" }, 401);
    }
    return null;
  };
}
