export type Handler = (ctx: { req: Request; params: Record<string, string> }) => Response | Promise<Response>;

type Route = { method: string; pattern: RegExp; handler: Handler };

function pathToRegex(path: string): RegExp {
  let rx = path.replace(/\/+/g, "/").replace(/\/:([A-Za-z0-9_]+)/g, "/(?<$1>[^/]+)");
  rx = rx.endsWith("/*") ? rx.slice(0, -2) + "(?:/.*)?" : rx.replace(/\*/g, ".*");
  return new RegExp(`^${rx}$`);
}

export class Router {
  private routes: Route[] = [];

  on(method: string, path: string, handler: Handler) {
    this.routes.push({ method: method.toUpperCase(), pattern: pathToRegex(path), handler });
    return this;
  }

  async handle(req: Request): Promise<Response | undefined> {
    const { pathname } = new URL(req.url);
    for (const r of this.routes) {
      if (r.method !== req.method) continue;
      const m = pathname.match(r.pattern);
      if (m) return r.handler({ req, params: m.groups ?? {} });
    }
  }
}
