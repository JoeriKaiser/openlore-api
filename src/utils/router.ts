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

  // Handle wildcard at the end of path
  if (rx.endsWith("/*")) {
    rx = rx.slice(0, -2) + "(?:/.*)?";
  } else {
    // Handle wildcard anywhere in the path
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
    console.log(`🛣️ Registered route: ${method.toUpperCase()} ${path} -> ${regex}`);
    return this;
  }

  async handle(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url);
    console.log(`🔍 Router handling: ${req.method} ${url.pathname}`);
    console.log(`📚 Available routes (${this.routes.length}):`);

    for (const r of this.routes) {
      console.log(`  - ${r.method} ${r.pattern}`);

      if (r.method !== req.method.toUpperCase()) {
        console.log(`    ❌ Method mismatch: ${req.method} !== ${r.method}`);
        continue;
      }

      const m = url.pathname.match(r.pattern);
      console.log(`    🎯 Pattern match result:`, m?.groups);
      console.log(`    🎯 Pattern matched:`, !!m);

      if (m) {
        const params = m.groups || {};
        console.log(`    ✅ Route matched! Calling handler with params:`, params);
        try {
          const result = await r.handler({
            req,
            params: params as Record<string, string>,
          });
          console.log(`    ✅ Handler completed successfully`);
          return result;
        } catch (error) {
          console.error(`    ❌ Handler error:`, error);
          throw error;
        }
      }
    }

    console.log(`❌ No route matched for: ${req.method} ${url.pathname}`);
    return undefined;
  }
}