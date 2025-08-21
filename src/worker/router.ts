export interface Route {
  method: string;
  path: string;
  handler: (request: Request) => Promise<Response>;
}

export class Router {
  private routes: Route[] = [];

  get(path: string, handler: (request: Request) => Promise<Response>) {
    this.routes.push({ method: 'GET', path, handler });
  }

  post(path: string, handler: (request: Request) => Promise<Response>) {
    this.routes.push({ method: 'POST', path, handler });
  }

  put(path: string, handler: (request: Request) => Promise<Response>) {
    this.routes.push({ method: 'PUT', path, handler });
  }

  delete(path: string, handler: (request: Request) => Promise<Response>) {
    this.routes.push({ method: 'DELETE', path, handler });
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    // Find matching route
    const route = this.routes.find(r => 
      r.method === method && this.matchPath(r.path, path)
    );

    if (route) {
      try {
        return await route.handler(request);
      } catch (error) {
        console.error(`Error in route ${route.method} ${route.path}:`, error);
        return new Response(
          JSON.stringify({ error: 'Route handler error' }),
          { 
            status: 500, 
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }
    }

    return new Response('Not found', { 
      status: 404,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  private matchPath(routePath: string, requestPath: string): boolean {
    // Simple path matching with parameter support
    const routeParts = routePath.split('/').filter(Boolean);
    const requestParts = requestPath.split('/').filter(Boolean);

    if (routeParts.length !== requestParts.length) {
      return false;
    }

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':') || routeParts[i] === requestParts[i]) {
        continue;
      }
      return false;
    }

    return true;
  }

  getPathParams(routePath: string, requestPath: string): Record<string, string> {
    const params: Record<string, string> = {};
    const routeParts = routePath.split('/').filter(Boolean);
    const requestParts = requestPath.split('/').filter(Boolean);

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        const paramName = routeParts[i].slice(1);
        params[paramName] = requestParts[i];
      }
    }

    return params;
  }
}