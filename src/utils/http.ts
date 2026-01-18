import { config } from "../../lib/env";

/**
 * Validates a request origin against the trusted origins list.
 * Returns the origin if allowed, otherwise falls back to clientUrl.
 */
export function getValidatedOrigin(requestOrigin: string | null): string {
  if (!requestOrigin) {
    return config.clientUrl;
  }
  if (config.trustedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }
  return config.clientUrl;
}

/**
 * Returns CORS headers with the validated origin for a given request origin.
 */
export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const validatedOrigin = getValidatedOrigin(requestOrigin);
  return {
    "Access-Control-Allow-Origin": validatedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie, Set-Cookie, X-Requested-With, Accept, Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Expose-Headers": "Set-Cookie",
    "Access-Control-Max-Age": "86400",
  };
}

// Static CORS headers for backwards compatibility (uses default clientUrl)
export const CORS_HEADERS: Record<string, string> = getCorsHeaders(null);

/**
 * Wraps a response with CORS headers based on the request's origin.
 */
export function withCorsForRequest(res: Response, req: Request): Response {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  const headers = new Headers(res.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
  const clonedBody = res.body ? res.clone().body : null;
  return new Response(clonedBody, { status: res.status, statusText: res.statusText, headers });
}

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

/**
 * Serializes a session cookie string with proper attributes based on environment config.
 * Uses SameSite=None and Secure flag for cross-site deployments.
 */
export function serializeSessionCookie(name: string, value: string, expiresAt: Date): string {
  const sameSite = config.isCrossSite ? "None" : "Lax";
  const secure = config.isProd || config.isCrossSite;
  const expiresStr = expiresAt.toUTCString();

  let cookie = `${name}=${value}; Path=/; HttpOnly; SameSite=${sameSite}; Expires=${expiresStr}`;
  if (secure) {
    cookie += "; Secure";
  }
  return cookie;
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
