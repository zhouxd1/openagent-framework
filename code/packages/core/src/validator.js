"use strict";
/**
 * Unified Input Validation System
 *
 * Provides schema-based validation for tools, adapters, and core operations.
 * Built with type safety and clear error messages in mind.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolSchemaBuilder = exports.CommonSchemas = exports.Validator = exports.SchemaValidationError = void 0;
const zod_1 = require("zod");
/**
 * Validation error with detailed information
 */
class SchemaValidationError extends Error {
    errors;
    constructor(message, errors) {
        super(message);
        this.errors = errors;
        this.name = 'SchemaValidationError';
    }
    /**
     * Format errors for display
     */
    formatErrors() {
        return this.errors
            .map(e => `  - ${e.path}: ${e.message} (${e.code})`)
            .join('\n');
    }
}
exports.SchemaValidationError = SchemaValidationError;
/**
 * Validator class provides unified validation methods
 */
class Validator {
    /**
     * Validate input against a schema
     * Throws SchemaValidationError on failure
     */
    static validate(schema, input, context) {
        const result = schema.safeParse(input);
        if (!result.success) {
            const errors = result.error.errors.map(err => ({
                path: err.path.join('.') || 'root',
                message: err.message,
                code: err.code,
            }));
            throw new SchemaValidationError(context
                ? `Validation failed for ${context}:\n${errors.map(e => `  - ${e.path}: ${e.message}`).join('\n')}`
                : 'Validation failed', errors);
        }
        return result.data;
    }
    /**
     * Validate input without throwing
     * Returns validation result object
     */
    static safeValidate(schema, input) {
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
    static createValidator(schema, context) {
        return (input) => Validator.validate(schema, input, context);
    }
}
exports.Validator = Validator;
/**
 * Common validation schemas
 */
exports.CommonSchemas = {
    /**
     * Non-empty string with max length
     */
    nonEmptyString: (maxLength = 1000) => zod_1.z.string().min(1, 'Value cannot be empty').max(maxLength, `Value cannot exceed ${maxLength} characters`),
    /**
     * Positive number
     */
    positiveNumber: () => zod_1.z.number().positive('Value must be positive'),
    /**
     * Non-negative number
     */
    nonNegativeNumber: () => zod_1.z.number().nonnegative('Value must be non-negative'),
    /**
     * UUID format
     */
    uuid: () => zod_1.z.string().uuid('Invalid UUID format'),
    /**
     * Email format
     */
    email: () => zod_1.z.string().email('Invalid email format'),
    /**
     * URL format
     */
    url: () => zod_1.z.string().url('Invalid URL format'),
    /**
     * JSON string
     */
    jsonString: () => zod_1.z.string().refine((val) => {
        try {
            JSON.parse(val);
            return true;
        }
        catch {
            return false;
        }
    }, { message: 'Invalid JSON string' }),
    /**
     * Date string (ISO 8601)
     */
    isoDateString: () => zod_1.z.string().datetime('Invalid ISO date format'),
    /**
     * Enum with custom error message
     */
    enum: (values, message) => zod_1.z.enum(values, {
        errorMap: () => ({ message: message || `Must be one of: ${values.join(', ')}` }),
    }),
};
/**
 * Tool parameter schema builder
 */
class ToolSchemaBuilder {
    /**
     * Build a tool parameter schema
     */
    static build(fields) {
        return zod_1.z.object(fields);
    }
    /**
     * Optional field with default
     */
    static optional(schema, defaultValue) {
        return defaultValue !== undefined
            ? schema.optional().default(defaultValue)
            : schema.optional();
    }
}
exports.ToolSchemaBuilder = ToolSchemaBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmFsaWRhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7O0FBRUgsNkJBQXdCO0FBRXhCOztHQUVHO0FBQ0gsTUFBYSxxQkFBc0IsU0FBUSxLQUFLO0lBRzVCO0lBRmxCLFlBQ0UsT0FBZSxFQUNDLE1BSWQ7UUFFRixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFOQyxXQUFNLEdBQU4sTUFBTSxDQUlwQjtRQUdGLElBQUksQ0FBQyxJQUFJLEdBQUcsdUJBQXVCLENBQUM7SUFDdEMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsWUFBWTtRQUNWLE9BQU8sSUFBSSxDQUFDLE1BQU07YUFDZixHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUM7YUFDbkQsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hCLENBQUM7Q0FDRjtBQXJCRCxzREFxQkM7QUFvQkQ7O0dBRUc7QUFDSCxNQUFhLFNBQVM7SUFDcEI7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLFFBQVEsQ0FBSSxNQUFzQixFQUFFLEtBQWMsRUFBRSxPQUFnQjtRQUN6RSxNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXZDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDcEIsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDN0MsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU07Z0JBQ2xDLE9BQU8sRUFBRSxHQUFHLENBQUMsT0FBTztnQkFDcEIsSUFB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QUM7WUFDaEIsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQUMsTUFBTSxDQUFDO1lBQ1AsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO0lBQ0gsQ0FBQyxFQUNELEVBQUUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLENBQ25DO0lBRUg7O09BRUc7SUFDSCxhQUFhLEVBQUUsR0FBRyxFQUFFLENBQ2xCLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLENBQUMseUJBQXlCLENBQUM7SUFFaEQ7O09BRUc7SUFDSCxJQUFJLEVBQUUsQ0FBa0MsTUFBUyxFQUFFLE9BQWdCLEVBQUUsRUFBRSxDQUNyRSxPQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUNiLFFBQVEsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLE9BQU8sSUFBSSxtQkFBbUIsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUM7S0FDakYsQ0FBQztDQUNMLENBQUM7QUFFRjs7R0FFRztBQUNILE1BQWEsaUJBQWlCO0lBQzVCOztPQUVHO0lBQ0gsTUFBTSxDQUFDLEtBQUssQ0FBeUMsTUFBUztRQUM1RCxPQUFPLE9BQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDMUIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLFFBQVEsQ0FBeUIsTUFBUyxFQUFFLFlBQXlCO1FBQzFFLE9BQU8sWUFBWSxLQUFLLFNBQVM7WUFDL0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDO1lBQ3pDLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDeEIsQ0FBQztDQUNGO0FBaEJELDhDQWdCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVW5pZmllZCBJbnB1dCBWYWxpZGF0aW9uIFN5c3RlbVxuICogXG4gKiBQcm92aWRlcyBzY2hlbWEtYmFzZWQgdmFsaWRhdGlvbiBmb3IgdG9vbHMsIGFkYXB0ZXJzLCBhbmQgY29yZSBvcGVyYXRpb25zLlxuICogQnVpbHQgd2l0aCB0eXBlIHNhZmV0eSBhbmQgY2xlYXIgZXJyb3IgbWVzc2FnZXMgaW4gbWluZC5cbiAqL1xuXG5pbXBvcnQgeyB6IH0gZnJvbSAnem9kJztcblxuLyoqXG4gKiBWYWxpZGF0aW9uIGVycm9yIHdpdGggZGV0YWlsZWQgaW5mb3JtYXRpb25cbiAqL1xuZXhwb3J0IGNsYXNzIFNjaGVtYVZhbGlkYXRpb25FcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgbWVzc2FnZTogc3RyaW5nLFxuICAgIHB1YmxpYyByZWFkb25seSBlcnJvcnM6IEFycmF5PHtcbiAgICAgIHBhdGg6IHN0cmluZztcbiAgICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgICAgIGNvZGU6IHN0cmluZztcbiAgICB9PlxuICApIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSAnU2NoZW1hVmFsaWRhdGlvbkVycm9yJztcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3JtYXQgZXJyb3JzIGZvciBkaXNwbGF5XG4gICAqL1xuICBmb3JtYXRFcnJvcnMoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5lcnJvcnNcbiAgICAgIC5tYXAoZSA9PiBgICAtICR7ZS5wYXRofTogJHtlLm1lc3NhZ2V9ICgke2UuY29kZX0pYClcbiAgICAgIC5qb2luKCdcXG4nKTtcbiAgfVxufVxuXG4vKipcbiAqIFNjaGVtYSB0eXBlcyBzdXBwb3J0ZWQgYnkgdGhlIHZhbGlkYXRvclxuICovXG5leHBvcnQgdHlwZSBTY2hlbWEgPSB6LlpvZFR5cGU8YW55LCBhbnksIGFueT47XG5cbi8qKlxuICogVmFsaWRhdGlvbiByZXN1bHRcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBWYWxpZGF0aW9uUmVzdWx0PFQ+IHtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgZGF0YT86IFQ7XG4gIGVycm9ycz86IEFycmF5PHtcbiAgICBwYXRoOiBzdHJpbmc7XG4gICAgbWVzc2FnZTogc3RyaW5nO1xuICAgIGNvZGU6IHN0cmluZztcbiAgfT47XG59XG5cbi8qKlxuICogVmFsaWRhdG9yIGNsYXNzIHByb3ZpZGVzIHVuaWZpZWQgdmFsaWRhdGlvbiBtZXRob2RzXG4gKi9cbmV4cG9ydCBjbGFzcyBWYWxpZGF0b3Ige1xuICAvKipcbiAgICogVmFsaWRhdGUgaW5wdXQgYWdhaW5zdCBhIHNjaGVtYVxuICAgKiBUaHJvd3MgU2NoZW1hVmFsaWRhdGlvbkVycm9yIG9uIGZhaWx1cmVcbiAgICovXG4gIHN0YXRpYyB2YWxpZGF0ZTxUPihzY2hlbWE6IHouWm9kU2NoZW1hPFQ+LCBpbnB1dDogdW5rbm93biwgY29udGV4dD86IHN0cmluZyk6IFQge1xuICAgIGNvbnN0IHJlc3VsdCA9IHNjaGVtYS5zYWZlUGFyc2UoaW5wdXQpO1xuXG4gICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgY29uc3QgZXJyb3JzID0gcmVzdWx0LmVycm9yLmVycm9ycy5tYXAoZXJyID0+ICh7XG4gICAgICAgIHBhdGg6IGVyci5wYXRoLmpvaW4oJy4nKSB8fCAncm9vdCcsXG4gICAgICAgIG1lc3NhZ2U6IGVyci5tZXNzYWdlLFxuICAgICAgICBjb2RlOiBlcnIuY29kZSxcbiAgICAgIH0pKTtcblxuICAgICAgdGhyb3cgbmV3IFNjaGVtYVZhbGlkYXRpb25FcnJvcihcbiAgICAgICAgY29udGV4dFxuICAgICAgICAgID8gYFZhbGlkYXRpb24gZmFpbGVkIGZvciAke2NvbnRleHR9OlxcbiR7ZXJyb3JzLm1hcChlID0+IGAgIC0gJHtlLnBhdGh9OiAke2UubWVzc2FnZX1gKS5qb2luKCdcXG4nKX1gXG4gICAgICAgICAgOiAnVmFsaWRhdGlvbiBmYWlsZWQnLFxuICAgICAgICBlcnJvcnNcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdC5kYXRhO1xuICB9XG5cbiAgLyoqXG4gICAqIFZhbGlkYXRlIGlucHV0IHdpdGhvdXQgdGhyb3dpbmdcbiAgICogUmV0dXJucyB2YWxpZGF0aW9uIHJlc3VsdCBvYmplY3RcbiAgICovXG4gIHN0YXRpYyBzYWZlVmFsaWRhdGU8VD4oc2NoZW1hOiB6LlpvZFNjaGVtYTxUPiwgaW5wdXQ6IHVua25vd24pOiBWYWxpZGF0aW9uUmVzdWx0PFQ+IHtcbiAgICBjb25zdCByZXN1bHQgPSBzY2hlbWEuc2FmZVBhcnNlKGlucHV0KTtcblxuICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBlcnJvcnM6IHJlc3VsdC5lcnJvci5lcnJvcnMubWFwKGVyciA9PiAoe1xuICAgICAgICAgIHBhdGg6IGVyci5wYXRoLmpvaW4oJy4nKSB8fCAncm9vdCcsXG4gICAgICAgICAgbWVzc2FnZTogZXJyLm1lc3NhZ2UsXG4gICAgICAgICAgY29kZTogZXJyLmNvZGUsXG4gICAgICAgIH0pKSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIHZhbGlkYXRvciBmdW5jdGlvbiBmb3IgYSBzY2hlbWFcbiAgICovXG4gIHN0YXRpYyBjcmVhdGVWYWxpZGF0b3I8VD4oc2NoZW1hOiB6LlpvZFNjaGVtYTxUPiwgY29udGV4dD86IHN0cmluZykge1xuICAgIHJldHVybiAoaW5wdXQ6IHVua25vd24pOiBUID0+IFZhbGlkYXRvci52YWxpZGF0ZShzY2hlbWEsIGlucHV0LCBjb250ZXh0KTtcbiAgfVxufVxuXG4vKipcbiAqIENvbW1vbiB2YWxpZGF0aW9uIHNjaGVtYXNcbiAqL1xuZXhwb3J0IGNvbnN0IENvbW1vblNjaGVtYXMgPSB7XG4gIC8qKlxuICAgKiBOb24tZW1wdHkgc3RyaW5nIHdpdGggbWF4IGxlbmd0aFxuICAgKi9cbiAgbm9uRW1wdHlTdHJpbmc6IChtYXhMZW5ndGg6IG51bWJlciA9IDEwMDApID0+XG4gICAgei5zdHJpbmcoKS5taW4oMSwgJ1ZhbHVlIGNhbm5vdCBiZSBlbXB0eScpLm1heChtYXhMZW5ndGgsIGBWYWx1ZSBjYW5ub3QgZXhjZWVkICR7bWF4TGVuZ3RofSBjaGFyYWN0ZXJzYCksXG5cbiAgLyoqXG4gICAqIFBvc2l0aXZlIG51bWJlclxuICAgKi9cbiAgcG9zaXRpdmVOdW1iZXI6ICgpID0+XG4gICAgei5udW1iZXIoKS5wb3NpdGl2ZSgnVmFsdWUgbXVzdCBiZSBwb3NpdGl2ZScpLFxuXG4gIC8qKlxuICAgKiBOb24tbmVnYXRpdmUgbnVtYmVyXG4gICAqL1xuICBub25OZWdhdGl2ZU51bWJlcjogKCkgPT5cbiAgICB6Lm51bWJlcigpLm5vbm5lZ2F0aXZlKCdWYWx1ZSBtdXN0IGJlIG5vbi1uZWdhdGl2ZScpLFxuXG4gIC8qKlxuICAgKiBVVUlEIGZvcm1hdFxuICAgKi9cbiAgdXVpZDogKCkgPT5cbiAgICB6LnN0cmluZygpLnV1aWQoJ0ludmFsaWQgVVVJRCBmb3JtYXQnKSxcblxuICAvKipcbiAgICogRW1haWwgZm9ybWF0XG4gICAqL1xuICBlbWFpbDogKCkgPT5cbiAgICB6LnN0cmluZygpLmVtYWlsKCdJbnZhbGlkIGVtYWlsIGZvcm1hdCcpLFxuXG4gIC8qKlxuICAgKiBVUkwgZm9ybWF0XG4gICAqL1xuICB1cmw6ICgpID0+XG4gICAgei5zdHJpbmcoKS51cmwoJ0ludmFsaWQgVVJMIGZvcm1hdCcpLFxuXG4gIC8qKlxuICAgKiBKU09OIHN0cmluZ1xuICAgKi9cbiAganNvblN0cmluZzogKCkgPT5cbiAgICB6LnN0cmluZygpLnJlZmluZShcbiAgICAgICh2YWwpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBKU09OLnBhcnNlKHZhbCk7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHsgbWVzc2FnZTogJ0ludmFsaWQgSlNPTiBzdHJpbmcnIH1cbiAgICApLFxuXG4gIC8qKlxuICAgKiBEYXRlIHN0cmluZyAoSVNPIDg2MDEpXG4gICAqL1xuICBpc29EYXRlU3RyaW5nOiAoKSA9PlxuICAgIHouc3RyaW5nKCkuZGF0ZXRpbWUoJ0ludmFsaWQgSVNPIGRhdGUgZm9ybWF0JyksXG5cbiAgLyoqXG4gICAqIEVudW0gd2l0aCBjdXN0b20gZXJyb3IgbWVzc2FnZVxuICAgKi9cbiAgZW51bTogPFQgZXh0ZW5kcyBbc3RyaW5nLCAuLi5zdHJpbmdbXV0+KHZhbHVlczogVCwgbWVzc2FnZT86IHN0cmluZykgPT5cbiAgICB6LmVudW0odmFsdWVzLCB7XG4gICAgICBlcnJvck1hcDogKCkgPT4gKHsgbWVzc2FnZTogbWVzc2FnZSB8fCBgTXVzdCBiZSBvbmUgb2Y6ICR7dmFsdWVzLmpvaW4oJywgJyl9YCB9KSxcbiAgICB9KSxcbn07XG5cbi8qKlxuICogVG9vbCBwYXJhbWV0ZXIgc2NoZW1hIGJ1aWxkZXJcbiAqL1xuZXhwb3J0IGNsYXNzIFRvb2xTY2hlbWFCdWlsZGVyIHtcbiAgLyoqXG4gICAqIEJ1aWxkIGEgdG9vbCBwYXJhbWV0ZXIgc2NoZW1hXG4gICAqL1xuICBzdGF0aWMgYnVpbGQ8VCBleHRlbmRzIFJlY29yZDxzdHJpbmcsIHouWm9kVHlwZUFueT4+KGZpZWxkczogVCkge1xuICAgIHJldHVybiB6Lm9iamVjdChmaWVsZHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIE9wdGlvbmFsIGZpZWxkIHdpdGggZGVmYXVsdFxuICAgKi9cbiAgc3RhdGljIG9wdGlvbmFsPFQgZXh0ZW5kcyB6LlpvZFR5cGVBbnk+KHNjaGVtYTogVCwgZGVmYXVsdFZhbHVlPzogei5pbmZlcjxUPikge1xuICAgIHJldHVybiBkZWZhdWx0VmFsdWUgIT09IHVuZGVmaW5lZFxuICAgICAgPyBzY2hlbWEub3B0aW9uYWwoKS5kZWZhdWx0KGRlZmF1bHRWYWx1ZSlcbiAgICAgIDogc2NoZW1hLm9wdGlvbmFsKCk7XG4gIH1cbn1cbiJdfQ==