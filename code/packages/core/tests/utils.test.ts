/**
 * Tests for utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  generateId,
  deepClone,
  safeJsonParse,
  safeJsonStringify,
  isValidJson,
  truncate,
  deepMerge,
  removeNullish,
} from '../src/utils';

describe('generateId', () => {
  it('should generate a unique ID', () => {
    const id1 = generateId();
    const id2 = generateId();

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});

describe('deepClone', () => {
  it('should deeply clone an object', () => {
    const original = {
      a: 1,
      b: { c: 2, d: [3, 4] },
    };
    const cloned = deepClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);
    expect(cloned.b.d).not.toBe(original.b.d);
  });
});

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    const result = safeJsonParse('{"a":1}', {});
    expect(result).toEqual({ a: 1 });
  });

  it('should return fallback for invalid JSON', () => {
    const result = safeJsonParse('invalid', { default: true });
    expect(result).toEqual({ default: true });
  });
});

describe('safeJsonStringify', () => {
  it('should stringify valid objects', () => {
    const result = safeJsonStringify({ a: 1 });
    expect(result).toBe('{"a":1}');
  });

  it('should handle circular references', () => {
    const obj: any = { a: 1 };
    obj.circular = obj;
    const result = safeJsonStringify(obj);
    expect(result).toBeNull();
  });
});

describe('isValidJson', () => {
  it('should return true for valid JSON', () => {
    expect(isValidJson('{"a":1}')).toBe(true);
    expect(isValidJson('[1,2,3]')).toBe(true);
  });

  it('should return false for invalid JSON', () => {
    expect(isValidJson('invalid')).toBe(false);
    expect(isValidJson('{a:1}')).toBe(false);
  });
});

describe('truncate', () => {
  it('should truncate long strings', () => {
    const result = truncate('This is a long string', 10);
    expect(result).toBe('This is...');
    expect(result.length).toBe(10);
  });

  it('should not truncate short strings', () => {
    const result = truncate('Short', 10);
    expect(result).toBe('Short');
  });
});

describe('deepMerge', () => {
  it('should deeply merge objects', () => {
    const target = { a: 1, b: { c: 2 } };
    const source = { b: { d: 3 }, e: 4 };
    const result = deepMerge(target, source);

    expect(result).toEqual({
      a: 1,
      b: { c: 2, d: 3 },
      e: 4,
    });
  });
});

describe('removeNullish', () => {
  it('should remove null and undefined values', () => {
    const obj = { a: 1, b: null, c: undefined, d: 'test' };
    const result = removeNullish(obj);

    expect(result).toEqual({ a: 1, d: 'test' });
  });
});
