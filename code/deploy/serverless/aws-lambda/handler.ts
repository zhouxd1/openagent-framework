import type { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { Context } from 'aws-lambda';

/**
 * OpenAgent Lambda Handler for AWS Lambda
 * 
 * This handler adapts OpenAgent Framework to work with AWS Lambda
 */

interface OpenAgentEvent {
  path: string;
  httpMethod: string;
  headers: Record<string, string>;
  queryStringParameters: Record<string, string> | null;
  body: string | null;
}

interface OpenAgentResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

// Lazy load OpenAgent to reduce cold start time
let openAgentHandler: ((event: OpenAgentEvent) => Promise<OpenAgentResponse>) | null = null;

async function getHandler() {
  if (!openAgentHandler) {
    // Import OpenAgent core
    const { createServer } = await import('@openagent/core');
    const server = await createServer({
      // Lambda-specific configuration
      adapter: 'lambda',
      logLevel: process.env.LOG_LEVEL || 'info',
    });

    openAgentHandler = async (event: OpenAgentEvent) => {
      try {
        const result = await server.handleRequest({
          method: event.httpMethod,
          path: event.path,
          headers: event.headers,
          query: event.queryStringParameters || {},
          body: event.body ? JSON.parse(event.body) : undefined,
        });

        return {
          statusCode: result.statusCode || 200,
          headers: {
            'Content-Type': 'application/json',
            ...result.headers,
          },
          body: JSON.stringify(result.body),
        };
      } catch (error) {
        console.error('OpenAgent Error:', error);
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' 
              ? (error as Error).message 
              : 'An error occurred',
          }),
        };
      }
    };
  }

  return openAgentHandler;
}

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Freeze context to prevent Lambda from waiting for event loop
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    const handler = await getHandler();

    const openAgentEvent: OpenAgentEvent = {
      path: event.path,
      httpMethod: event.httpMethod,
      headers: event.headers as Record<string, string>,
      queryStringParameters: event.queryStringParameters,
      body: event.body,
    };

    const result = await handler(openAgentEvent);

    return {
      statusCode: result.statusCode,
      headers: result.headers,
      body: result.body,
    };
  } catch (error) {
    console.error('Lambda Handler Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      }),
    };
  }
};
