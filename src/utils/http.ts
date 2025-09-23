import type { HeadersInit } from "bun";
import { config } from "../../lib/env";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": config.clientUrl,
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};

export function json(data: unknown, init: number | ResponseInit = 200): Response {
  const base: ResponseInit = typeof init === "number" ? { status: init } : init ?? {};
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

export function createSSE() {
  const ts = new TransformStream<Uint8Array, Uint8Array>();
  const writer = ts.writable.getWriter();
  const encoder = new TextEncoder();

  const headers = new Headers({
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));

  const response = new Response(ts.readable, { status: 200, headers });

  async function write(event: string, data?: unknown) {
    let chunk = "";
    if (event) chunk += `event: ${event}\n`;
    if (data !== undefined) chunk += `data: ${JSON.stringify(data)}\n`;
    chunk += `\n`;
    await writer.write(encoder.encode(chunk));
  }

  async function close() {
    await writer.close();
  }

  return { response, write, close };
}
