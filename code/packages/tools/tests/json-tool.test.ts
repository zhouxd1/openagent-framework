/**
 * Tests for JSON Tools
 */

import { describe, it, expect } from 'vitest';
import {
  jsonParseToolDefinition,
  jsonParseHandler,
  jsonStringifyToolDefinition,
  jsonStringifyHandler,
} from '../src/builtin/json-tool';

describe('jsonParseToolDefinition', () => {
  it('should have correct name', () => {
    expect(jsonParseToolDefinition.name).toBe('json_parse');
  });

  it('should have required text parameter', () => {
    expect(jsonParseToolDefinition.parameters.text.required).toBe(true);
    expect(jsonParseToolDefinition.parameters.text.type).toBe('string');
  });

  it('should be data category', () => {
    expect(jsonParseToolDefinition.category).toBe('data');
  });
});

describe('jsonParseHandler', () => {
  describe('basic parsing', () => {
    it('should parse valid JSON object', async () => {
      const result = await jsonParseHandler({ 
        text: '{"name": "John", "age": 30}' 
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'John', age: 30 });
    });

    it('should parse valid JSON array', async () => {
      const result = await jsonParseHandler({ 
        text: '[1, 2, 3, 4, 5]' 
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3, 4, 5]);
    });

    it('should parse JSON string', async () => {
      const result = await jsonParseHandler({ 
        text: '"Hello, World!"' 
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('Hello, World!');
    });

    it('should parse JSON number', async () => {
      const result = await jsonParseHandler({ 
        text: '42.5' 
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(42.5);
    });

    it('should parse JSON boolean', async () => {
      const result = await jsonParseHandler({ 
        text: 'true' 
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should parse JSON null', async () => {
      const result = await jsonParseHandler({ 
        text: 'null' 
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(null);
    });
  });

  describe('complex JSON', () => {
    it('should parse nested objects', async () => {
      const result = await jsonParseHandler({ 
        text: '{"user": {"name": "Alice", "address": {"city": "NYC"}}}' 
      });

      expect(result.success).toBe(true);
      expect(result.data.user.name).toBe('Alice');
      expect(result.data.user.address.city).toBe('NYC');
    });

    it('should parse arrays of objects', async () => {
      const result = await jsonParseHandler({ 
        text: '[{"id": 1}, {"id": 2}, {"id": 3}]' 
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data[1].id).toBe(2);
    });

    it('should parse mixed content', async () => {
      const result = await jsonParseHandler({ 
        text: '{"items": [1, "two", true, null]}' 
      });

      expect(result.success).toBe(true);
      expect(result.data.items).toEqual([1, 'two', true, null]);
    });
  });

  describe('JSONPath extraction', () => {
    it('should extract data using JSONPath', async () => {
      const result = await jsonParseHandler({ 
        text: '{"store": {"book": [{"title": "Book 1"}, {"title": "Book 2"}]}}',
        path: '$.store.book[*].title'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(['Book 1', 'Book 2']);
    });

    it('should extract single value', async () => {
      const result = await jsonParseHandler({ 
        text: '{"user": {"name": "Alice"}}',
        path: '$.user.name'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('Alice');
    });

    it('should handle nonexistent path', async () => {
      const result = await jsonParseHandler({ 
        text: '{"name": "Alice"}',
        path: '$.age'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle invalid JSONPath', async () => {
      const result = await jsonParseHandler({ 
        text: '{"name": "Alice"}',
        path: 'invalid..path'
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/jsonpath/i);
    });
  });

  describe('error handling', () => {
    it('should reject empty string', async () => {
      const result = await jsonParseHandler({ text: '' });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/empty/i);
    });

    it('should reject invalid JSON', async () => {
      const result = await jsonParseHandler({ 
        text: 'not valid json' 
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid json/i);
    });

    it('should reject unclosed object', async () => {
      const result = await jsonParseHandler({ 
        text: '{"name": "Alice"' 
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid json/i);
    });

    it('should reject trailing comma', async () => {
      const result = await jsonParseHandler({ 
        text: '{"name": "Alice",}' 
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid json/i);
    });
  });

  describe('metadata', () => {
    it('should include size metadata', async () => {
      const text = '{"test": "value"}';
      const result = await jsonParseHandler({ text });

      expect(result.success).toBe(true);
      expect(result.metadata?.textSize).toBe(text.length);
      expect(result.metadata?.dataSize).toBeDefined();
    });

    it('should include path metadata when using JSONPath', async () => {
      const result = await jsonParseHandler({ 
        text: '{"items": [1, 2, 3]}',
        path: '$.items'
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.path).toBe('$.items');
      expect(result.metadata?.resultCount).toBeDefined();
    });
  });
});

describe('jsonStringifyToolDefinition', () => {
  it('should have correct name', () => {
    expect(jsonStringifyToolDefinition.name).toBe('json_stringify');
  });

  it('should have required data parameter', () => {
    expect(jsonStringifyToolDefinition.parameters.data.required).toBe(true);
  });

  it('should be data category', () => {
    expect(jsonStringifyToolDefinition.category).toBe('data');
  });
});

describe('jsonStringifyHandler', () => {
  describe('basic stringification', () => {
    it('should stringify object', async () => {
      const result = await jsonStringifyHandler({ 
        data: { name: 'John', age: 30 } 
      });

      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
      expect(result.data).toContain('"name"');
      expect(result.data).toContain('John');
    });

    it('should stringify array', async () => {
      const result = await jsonStringifyHandler({ 
        data: [1, 2, 3, 4, 5] 
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('[\n  1,\n  2,\n  3,\n  4,\n  5\n]');
    });

    it('should stringify primitives', async () => {
      const result = await jsonStringifyHandler({ data: 'hello' });

      expect(result.success).toBe(true);
      expect(result.data).toBe('"hello"');
    });

    it('should stringify null', async () => {
      const result = await jsonStringifyHandler({ data: null });

      expect(result.success).toBe(true);
      expect(result.data).toBe('null');
    });
  });

  describe('formatting', () => {
    it('should pretty print by default', async () => {
      const result = await jsonStringifyHandler({ 
        data: { name: 'Alice' }
      });

      expect(result.success).toBe(true);
      expect(result.data).toContain('\n');
      expect(result.data).toContain('  ');
    });

    it('should not pretty print when pretty=false', async () => {
      const result = await jsonStringifyHandler({ 
        data: { name: 'Alice' },
        pretty: false
      });

      expect(result.success).toBe(true);
      expect(result.data).not.toContain('\n');
    });

    it('should respect custom indent size', async () => {
      const result = await jsonStringifyHandler({ 
        data: { name: 'Alice' },
        indent: 4
      });

      expect(result.success).toBe(true);
      expect(result.data).toContain('    '); // 4 spaces
    });

    it('should handle indent=0', async () => {
      const result = await jsonStringifyHandler({ 
        data: { name: 'Alice' },
        pretty: true,
        indent: 0
      });

      expect(result.success).toBe(true);
      expect(result.data).not.toContain('  ');
    });
  });

  describe('circular references', () => {
    it('should detect circular references', async () => {
      const obj: any = { name: 'Alice' };
      obj.self = obj;

      const result = await jsonStringifyHandler({ data: obj });

      expect(result.success).toBe(true);
      expect(result.metadata?.hasCircular).toBe(true);
      expect(result.data).toContain('[Circular]');
    });

    it('should handle nested circular references', async () => {
      const obj1: any = { name: 'Object 1' };
      const obj2: any = { name: 'Object 2' };
      obj1.ref = obj2;
      obj2.ref = obj1;

      const result = await jsonStringifyHandler({ data: obj1 });

      expect(result.success).toBe(true);
      expect(result.data).toContain('[Circular]');
    });

    it('should stringify non-circular objects normally', async () => {
      const result = await jsonStringifyHandler({ 
        data: { name: 'Alice', age: 30 }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.hasCircular).toBe(false);
      expect(result.data).not.toContain('[Circular]');
    });
  });

  describe('complex data', () => {
    it('should stringify nested objects', async () => {
      const result = await jsonStringifyHandler({ 
        data: {
          user: {
            name: 'Alice',
            address: {
              city: 'NYC'
            }
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toContain('Alice');
      expect(result.data).toContain('NYC');
    });

    it('should stringify arrays of objects', async () => {
      const result = await jsonStringifyHandler({ 
        data: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.data).toContain('Item 1');
      expect(result.data).toContain('Item 2');
    });

    it('should handle special characters', async () => {
      const result = await jsonStringifyHandler({ 
        data: { text: 'Line 1\nLine 2\tTabbed' }
      });

      expect(result.success).toBe(true);
      expect(result.data).toContain('\\n');
      expect(result.data).toContain('\\t');
    });

    it('should handle unicode characters', async () => {
      const result = await jsonStringifyHandler({ 
        data: { text: 'Hello 世界 🌍' }
      });

      expect(result.success).toBe(true);
      expect(result.data).toContain('世界');
      expect(result.data).toContain('🌍');
    });
  });

  describe('metadata', () => {
    it('should include size metadata', async () => {
      const result = await jsonStringifyHandler({ 
        data: { test: 'value' }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.size).toBeGreaterThan(0);
    });

    it('should include formatting metadata', async () => {
      const result = await jsonStringifyHandler({ 
        data: { test: 'value' },
        pretty: true,
        indent: 2
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.pretty).toBe(true);
      expect(result.metadata?.indent).toBe(2);
    });
  });
});
