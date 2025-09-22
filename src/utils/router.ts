export type Handler = (ctx: {
  req: Request;
  params: Record<string, string>;
}) => Response | Promise<Response>;

type Route = {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
};

function pathToRegex(path: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  let rx = path
    .replace(/\/+/g, "/")
    .replace(/\/:([A-Za-z0-9_]+)/g, (_, key) => {
      keys.push(key);
      return "/(?<" + key + ">[^/]+)";
    });

  if (rx.endsWith("/*")) {
    rx = rx.slice(0, -2) + "(?:/.*)?";
  } else {
    rx = rx.replace(/\*/g, ".*");
  }

  return { regex: new RegExp("^" + rx + "$"), keys };
}

export class Router {
  private routes: Route[] = [];

  on(method: string, path: string, handler: Handler): this {
    const { regex, keys } = pathToRegex(path);
    const route = {
      method: method.toUpperCase(),
      pattern: regex,
      keys,
      handler,
    };
    this.routes.push(route);
    return this;
  }

  async handle(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url);

    for (const r of this.routes) {
      if (r.method !== req.method.toUpperCase()) continue;
      const m = url.pathname.match(r.pattern);
      if (!m) continue;

      const params = m.groups || {};
      try {
        return await r.handler({
          req,
          params: params as Record<string, string>,
        });
      } catch (error) {
        throw error;
      }
    }

    return undefined;
  }
}
