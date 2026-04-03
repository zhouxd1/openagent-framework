/**
 * OpenAgent Vercel Edge Function Handler
 * 
 * This handler adapts OpenAgent Framework to work with Vercel Edge Functions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Edge Runtime configuration
export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1'], // Multi-region deployment
};

export default async function handler(req: VercelRequest): Promise<Response> {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Lazy load OpenAgent
    const { createServer } = await import('@openagent/core');
    
    // Initialize server with Edge Runtime configuration
    const server = await createServer({
      adapter: 'edge',
      logLevel: process.env.LOG_LEVEL || 'info',
    });

    // Parse request
    const url = new URL(req.url || '', `https://${req.headers.get('host')}`);
    const body = req.body ? await req.json() : undefined;

    // Handle request
    const result = await server.handleRequest({
      method: req.method || 'GET',
      path: url.pathname,
      headers: Object.fromEntries(req.headers.entries()),
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
        message: process.env.NODE_ENV === 'development'
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
