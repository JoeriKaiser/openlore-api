import { auth } from "../../lib/auth";

export async function getSession(req: Request) {
  try { return await auth.api.getSession({ headers: req.headers }); }
  catch { return null; }
}

export const getCurrentUser = async (req: Request) => (await getSession(req))?.user ?? null;
