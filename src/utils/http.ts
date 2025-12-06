import { config } from "../../lib/env";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": config.clientUrl,
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};

const withCors = (headers: Headers) => {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
  return headers;
};

export function json(data: unknown, init: number | ResponseInit = 200): Response {
  const base = typeof init === "number" ? { status: init } : init;
  const headers = withCors(new Headers(base.headers));
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...base, headers });
}

export const noContent = () => new Response(null, { status: 204, headers: withCors(new Headers()) });
export const badRequest = (message: string, details?: unknown) => json({ error: message, details }, 400);
export const notFound = () => json({ error: "Not Found" }, 404);
export const unauthorized = () => json({ error: "Unauthorized" }, 401);

export async function readJson<T>(req: Request): Promise<T> {
  try { return await req.json() as T; }
  catch { throw new Error("Invalid JSON body"); }
}

export function createSSE() {
  const ts = new TransformStream<Uint8Array, Uint8Array>();
  const writer = ts.writable.getWriter();
  const encoder = new TextEncoder();
  const headers = withCors(new Headers({
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
  }));

  return {
    response: new Response(ts.readable, { status: 200, headers }),
    write: async (event: string, data?: unknown) => {
      await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    },
    close: () => writer.close(),
  };
}
