/**
 * Tests for HTTP Tool
 */

import { describe, it, expect } from 'vitest';
import {
  httpRequestToolDefinition,
  httpRequestHandler,
} from '../src/builtin/http-tool';

describe('httpRequestToolDefinition', () => {
  it('should have correct name', () => {
    expect(httpRequestToolDefinition.name).toBe('http_request');
  });

  it('should have required url parameter', () => {
    expect(httpRequestToolDefinition.parameters.url.required).toBe(true);
    expect(httpRequestToolDefinition.parameters.url.type).toBe('string');
  });

  it('should be communication category', () => {
    expect(httpRequestToolDefinition.category).toBe('communication');
  });
});

describe('httpRequestHandler', () => {
  describe('validation', () => {
    it('should reject invalid URL', async () => {
      const result = await httpRequestHandler({ url: 'not-a-url' });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/url/i);
    });

    it('should reject missing URL', async () => {
      const result = await httpRequestHandler({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid HTTP method', async () => {
      const result = await httpRequestHandler({ 
        url: 'https://example.com',
        method: 'INVALID'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject timeout out of range', async () => {
      const result = await httpRequestHandler({ 
        url: 'https://example.com',
        timeout: 500 // Too low
      });

      expect(result.success).toBe(false);
    });
  });

  describe('GET requests', () => {
    it('should make successful GET request', async () => {
      // Using a reliable test API
      const result = await httpRequestHandler({ 
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        timeout: 10000
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.status).toBe(200);
      expect(result.data.data).toHaveProperty('id');
    }, 15000);

    it('should handle custom headers', async () => {
      const result = await httpRequestHandler({ 
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        headers: {
          'X-Custom-Header': 'test-value'
        },
        timeout: 10000
      });

      expect(result.success).toBe(true);
    }, 15000);

    it('should handle 404 response', async () => {
      const result = await httpRequestHandler({ 
        url: 'https://jsonplaceholder.typicode.com/posts/999999',
        timeout: 10000
      });

      expect(result.success).toBe(false);
      expect(result.data.status).toBe(404);
    }, 15000);
  });

  describe('POST requests', () => {
    it('should make successful POST request with JSON body', async () => {
      const result = await httpRequestHandler({ 
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        body: {
          title: 'Test Post',
          body: 'Test content',
          userId: 1
        },
        timeout: 10000
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(201);
      expect(result.data.data).toHaveProperty('id');
    }, 15000);

    it('should make POST request with string body', async () => {
      const result = await httpRequestHandler({ 
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        body: JSON.stringify({
          title: 'Test Post',
          body: 'Test content',
          userId: 1
        }),
        timeout: 10000
      });

      expect(result.success).toBe(true);
    }, 15000);
  });

  describe('PUT and PATCH requests', () => {
    it('should make PUT request', async () => {
      const result = await httpRequestHandler({ 
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'PUT',
        body: {
          id: 1,
          title: 'Updated Post',
          body: 'Updated content',
          userId: 1
        },
        timeout: 10000
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(200);
    }, 15000);

    it('should make PATCH request', async () => {
      const result = await httpRequestHandler({ 
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'PATCH',
        body: {
          title: 'Patched Title'
        },
        timeout: 10000
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(200);
    }, 15000);
  });

  describe('DELETE requests', () => {
    it('should make DELETE request', async () => {
      const result = await httpRequestHandler({ 
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'DELETE',
        timeout: 10000
      });

      expect(result.success).toBe(true);
      expect([200, 204]).toContain(result.data.status);
    }, 15000);
  });

  describe('error handling', () => {
    it('should handle timeout', async () => {
      const result = await httpRequestHandler({ 
        url: 'https://httpstat.us/200?sleep=2000',
        timeout: 1000 // 1 second timeout
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/timeout/i);
    }, 5000);

    it('should handle DNS failure', async () => {
      const result = await httpRequestHandler({ 
        url: 'https://nonexistent-domain-12345.com',
        timeout: 5000
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 10000);

    it('should handle connection refused', async () => {
      const result = await httpRequestHandler({ 
        url: 'http://localhost:99999',
        timeout: 5000
      });

      expect(result.success).toBe(false);
    }, 10000);
  });

  describe('metadata', () => {
    it('should include request metadata', async () => {
      const result = await httpRequestHandler({ 
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        timeout: 10000
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.url).toBeDefined();
      expect(result.metadata?.method).toBe('GET');
      expect(result.metadata?.status).toBe(200);
      expect(result.metadata?.duration).toBeDefined();
    }, 15000);

    it('should include response headers', async () => {
      const result = await httpRequestHandler({ 
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        timeout: 10000
      });

      expect(result.success).toBe(true);
      expect(result.data.headers).toBeDefined();
      expect(typeof result.data.headers).toBe('object');
    }, 15000);
  });
});
