/**
 * OpenAgent Cloudflare Worker Handler
 * 
 * This handler adapts OpenAgent Framework to work with Cloudflare Workers
 */

// Type definitions for Cloudflare Workers
interface FetchEvent {
  request: Request;
  respondWith(response: Promise<Response> | Response): void;
}

interface Env {
  NODE_ENV: string;
  LOG_LEVEL: string;
  DATABASE_URL: string;
  REDIS_URL: string;
}

/**
 * Handle HTTP requests
 */
async function handleRequest(request: Request, env: Env): Promise<Response> {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Lazy load OpenAgent (using dynamic import for Workers)
    const { createServer } = await import('@openagent/core');
    
    // Initialize server with Cloudflare Workers configuration
    const server = await createServer({
      adapter: 'cloudflare-workers',
      logLevel: env.LOG_LEVEL || 'info',
    });

    // Parse request
    const url = new URL(request.url);
    let body;
    
    if (request.body) {
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        body = await request.json();
      }
    }

    // Convert headers to plain object
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Handle request
    const result = await server.handleRequest({
      method: request.method,
      path: url.pathname,
      headers,
      query: Object.fromEntries(url.searchParams.entries()),
      body,
    });

    // Return response
    return new Response(JSON.stringify(result.body), {
      status: result.statusCode || 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
        ...result.headers,
      },
    });
  } catch (error) {
    console.error('OpenAgent Error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: env.NODE_ENV === 'development'
          ? (error as Error).message
          : 'An error occurred',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}

/**
 * Worker entry point
 */
addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(
    handleRequest(event.request, (event as any).env || {} as Env)
  );
});

// Export for ES modules syntax (newer Workers)
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
