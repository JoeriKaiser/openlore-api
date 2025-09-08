import type { HeadersInit } from "bun";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.CLIENT_URL ?? "",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};

export function json(
  data: unknown,
  init: number | ResponseInit = 200
): Response {
  const base: ResponseInit =
    typeof init === "number" ? { status: init } : init ?? {};
  const headers = new Headers(base.headers as HeadersInit);
  headers.set("content-type", "application/json; charset=utf-8");
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
  return new Response(JSON.stringify(data), { ...base, headers });
}

export function noContent(init?: ResponseInit): Response {
  const headers = new Headers(init?.headers as HeadersInit);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
  return new Response(null, { status: 204, ...init, headers });
}

export function badRequest(message: string, details?: unknown): Response {
  return json({ error: message, details }, 400);
}

export function notFound(): Response {
  return json({ error: "Not Found" }, 404);
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}