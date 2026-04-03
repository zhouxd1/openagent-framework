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
export declare class SchemaValidationError extends Error {
    readonly errors: Array<{
        path: string;
        message: string;
        code: string;
    }>;
    constructor(message: string, errors: Array<{
        path: string;
        message: string;
        code: string;
    }>);
    /**
     * Format errors for display
     */
    formatErrors(): string;
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
export declare class Validator {
    /**
     * Validate input against a schema
     * Throws SchemaValidationError on failure
     */
    static validate<T>(schema: z.ZodSchema<T>, input: unknown, context?: string): T;
    /**
     * Validate input without throwing
     * Returns validation result object
     */
    static safeValidate<T>(schema: z.ZodSchema<T>, input: unknown): ValidationResult<T>;
    /**
     * Create a validator function for a schema
     */
    static createValidator<T>(schema: z.ZodSchema<T>, context?: string): (input: unknown) => T;
}
/**
 * Common validation schemas
 */
export declare const CommonSchemas: {
    /**
     * Non-empty string with max length
     */
    nonEmptyString: (maxLength?: number) => z.ZodString;
    /**
     * Positive number
     */
    positiveNumber: () => z.ZodNumber;
    /**
     * Non-negative number
     */
    nonNegativeNumber: () => z.ZodNumber;
    /**
     * UUID format
     */
    uuid: () => z.ZodString;
    /**
     * Email format
     */
    email: () => z.ZodString;
    /**
     * URL format
     */
    url: () => z.ZodString;
    /**
     * JSON string
     */
    jsonString: () => z.ZodEffects<z.ZodString, string, string>;
    /**
     * Date string (ISO 8601)
     */
    isoDateString: () => z.ZodString;
    /**
     * Enum with custom error message
     */
    enum: <T extends [string, ...string[]]>(values: T, message?: string) => z.ZodEnum<z.Writeable<T>>;
};
/**
 * Tool parameter schema builder
 */
export declare class ToolSchemaBuilder {
    /**
     * Build a tool parameter schema
     */
    static build<T extends Record<string, z.ZodTypeAny>>(fields: T): z.ZodObject<T, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<T>, any> extends infer T_1 ? { [k in keyof T_1]: T_1[k]; } : never, z.baseObjectInputType<T> extends infer T_2 ? { [k_1 in keyof T_2]: T_2[k_1]; } : never>;
    /**
     * Optional field with default
     */
    static optional<T extends z.ZodTypeAny>(schema: T, defaultValue?: z.infer<T>): z.ZodOptional<T> | z.ZodDefault<z.ZodOptional<T>>;
}
