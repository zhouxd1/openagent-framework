import { describe, it, expect } from 'vitest';
import { Validator, ValidationError, CommonSchemas } from '../src/validator';
import { z } from 'zod';

describe('Validator', () => {
  describe('validate', () => {
    it('should validate valid input', () => {
      const schema = z.object({ name: z.string() });
      const result = Validator.validate(schema, { name: 'test' });
      expect(result).toEqual({ name: 'test' });
    });

    it('should throw ValidationError for invalid input', () => {
      const schema = z.object({ name: z.string().min(1) });
      expect(() => {
        Validator.validate(schema, { name: '' });
      }).toThrow(ValidationError);
    });

    it('should include context in error message', () => {
      const schema = z.object({ name: z.string().min(1) });
      try {
        Validator.validate(schema, { name: '' }, 'test context');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toContain('test context');
      }
    });
  });

  describe('safeValidate', () => {
    it('should return success result for valid input', () => {
      const schema = z.object({ name: z.string() });
      const result = Validator.safeValidate(schema, { name: 'test' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test' });
    });

    it('should return error result for invalid input', () => {
      const schema = z.object({ name: z.string().min(1) });
      const result = Validator.safeValidate(schema, { name: '' });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('createValidator', () => {
    it('should create a reusable validator function', () => {
      const schema = z.object({ age: z.number().positive() });
      const validate = Validator.createValidator(schema, 'age validator');

      expect(() => validate({ age: 25 })).not.toThrow();
      expect(() => validate({ age: -1 })).toThrow(ValidationError);
    });
  });
});

describe('CommonSchemas', () => {
  describe('nonEmptyString', () => {
    it('should accept non-empty strings', () => {
      const schema = CommonSchemas.nonEmptyString();
      expect(() => Validator.validate(schema, 'test')).not.toThrow();
    });

    it('should reject empty strings', () => {
      const schema = CommonSchemas.nonEmptyString();
      expect(() => Validator.validate(schema, '')).toThrow();
    });

    it('should enforce max length', () => {
      const schema = CommonSchemas.nonEmptyString(10);
      expect(() => Validator.validate(schema, '12345678901')).toThrow();
    });
  });

  describe('positiveNumber', () => {
    it('should accept positive numbers', () => {
      const schema = CommonSchemas.positiveNumber();
      expect(() => Validator.validate(schema, 1)).not.toThrow();
    });

    it('should reject zero and negative numbers', () => {
      const schema = CommonSchemas.positiveNumber();
      expect(() => Validator.validate(schema, 0)).toThrow();
      expect(() => Validator.validate(schema, -1)).toThrow();
    });
  });

  describe('enum', () => {
    it('should accept valid enum values', () => {
      const schema = CommonSchemas.enum(['a', 'b', 'c'] as const);
      expect(() => Validator.validate(schema, 'a')).not.toThrow();
    });

    it('should reject invalid enum values', () => {
      const schema = CommonSchemas.enum(['a', 'b', 'c'] as const);
      expect(() => Validator.validate(schema, 'd')).toThrow();
    });
  });
});
