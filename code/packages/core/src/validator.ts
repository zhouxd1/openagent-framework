/**
 * Unified Input Validation System
 * 
 * Provides schema-based validation for tools, adapters, and core operations.
 * Built with type safety and clear error messages in mind.
 */

import { z } from 'zod';

/**
 * Validation error with detailed information
 */
export class SchemaValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: Array<{
      path: string;
      message: string;
      code: string;
    }>
  ) {
    super(message);
    this.name = 'SchemaValidationError';
  }

  /**
   * Format errors for display
   */
  formatErrors(): string {
    return this.errors
      .map(e => `  - ${e.path}: ${e.message} (${e.code})`)
      .join('\n');
  }
}

/**
 * Schema types supported by the validator
 */
export type Schema = z.ZodType<any, any, any>;

/**
 * Validation result
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{
    path: string;
    message: string;
    code: string;
  }>;
}

/**
 * Validator class provides unified validation methods
 */
export class Validator {
  /**
   * Validate input against a schema
   * Throws SchemaValidationError on failure
   */
  static validate<T>(schema: z.ZodSchema<T>, input: unknown, context?: string): T {
    const result = schema.safeParse(input);

    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        path: err.path.join('.') || 'root',
        message: err.message,
        code: err.code,
      }));

      throw new SchemaValidationError(
        context
          ? `Validation failed for ${context}:\n${errors.map(e => `  - ${e.path}: ${e.message}`).join('\n')}`
          : 'Validation failed',
        errors
      );
    }

    return result.data;
  }

  /**
   * Validate input without throwing
   * Returns validation result object
   */
  static safeValidate<T>(schema: z.ZodSchema<T>, input: unknown): ValidationResult<T> {
    const result = schema.safeParse(input);

    if (!result.success) {
      return {
        success: false,
        errors: result.error.errors.map(err => ({
          path: err.path.join('.') || 'root',
          message: err.message,
          code: err.code,
        })),
      };
    }

    return {
      success: true,
      data: result.data,
    };
  }

  /**
   * Create a validator function for a schema
   */
  static createValidator<T>(schema: z.ZodSchema<T>, context?: string) {
    return (input: unknown): T => Validator.validate(schema, input, context);
  }
}

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  /**
   * Non-empty string with max length
   */
  nonEmptyString: (maxLength: number = 1000) =>
    z.string().min(1, 'Value cannot be empty').max(maxLength, `Value cannot exceed ${maxLength} characters`),

  /**
   * Positive number
   */
  positiveNumber: () =>
    z.number().positive('Value must be positive'),

  /**
   * Non-negative number
   */
  nonNegativeNumber: () =>
    z.number().nonnegative('Value must be non-negative'),

  /**
   * UUID format
   */
  uuid: () =>
    z.string().uuid('Invalid UUID format'),

  /**
   * Email format
   */
  email: () =>
    z.string().email('Invalid email format'),

  /**
   * URL format
   */
  url: () =>
    z.string().url('Invalid URL format'),

  /**
   * JSON string
   */
  jsonString: () =>
    z.string().refine(
      (val) => {
        try {
          JSON.parse(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Invalid JSON string' }
    ),

  /**
   * Date string (ISO 8601)
   */
  isoDateString: () =>
    z.string().datetime('Invalid ISO date format'),

  /**
   * Enum with custom error message
   */
  enum: <T extends [string, ...string[]]>(values: T, message?: string) =>
    z.enum(values, {
      errorMap: () => ({ message: message || `Must be one of: ${values.join(', ')}` }),
    }),
};

/**
 * Tool parameter schema builder
 */
export class ToolSchemaBuilder {
  /**
   * Build a tool parameter schema
   */
  static build<T extends Record<string, z.ZodTypeAny>>(fields: T) {
    return z.object(fields);
  }

  /**
   * Optional field with default
   */
  static optional<T extends z.ZodTypeAny>(schema: T, defaultValue?: z.infer<T>) {
    return defaultValue !== undefined
      ? schema.optional().default(defaultValue)
      : schema.optional();
  }
}
