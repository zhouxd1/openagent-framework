/**
 * Unified Logging System
 *
 * Provides structured logging with multiple levels, transports, and context support.
 */
/**
 * Log levels
 */
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
/**
 * Log context metadata
 */
export interface LogContext {
    [key: string]: any;
    timestamp?: string;
    sessionId?: string;
    userId?: string;
    toolName?: string;
    duration?: number;
}
/**
 * Log entry structure
 */
export interface LogEntry {
    level: LogLevel;
    message: string;
    context?: LogContext;
    error?: Error;
    timestamp: Date;
}
/**
 * Log transport interface (for different output destinations)
 */
export interface LogTransport {
    log(entry: LogEntry): void | Promise<void>;
}
/**
 * Console transport (default)
 */
export declare class ConsoleTransport implements LogTransport {
    private useColors;
    constructor(useColors?: boolean);
    log(entry: LogEntry): void;
    private sanitizeContext;
}
/**
 * File transport
 */
export declare class FileTransport implements LogTransport {
    private filePath;
    private options;
    private fs;
    private path;
    constructor(filePath: string, options?: {
        maxSize?: number;
        rotateFiles?: number;
    });
    log(entry: LogEntry): Promise<void>;
    private appendFile;
}
/**
 * Logger configuration
 */
export interface LoggerConfig {
    level?: LogLevel;
    transports?: LogTransport[];
    defaultContext?: LogContext;
}
/**
 * Logger class
 */
export declare class Logger {
    private level;
    private transports;
    private defaultContext;
    constructor(config?: LoggerConfig);
    /**
     * Set log level
     */
    setLevel(level: LogLevel): void;
    /**
     * Add transport
     */
    addTransport(transport: LogTransport): void;
    /**
     * Remove all transports
     */
    clearTransports(): void;
    /**
     * Create child logger with additional context
     */
    child(context: LogContext): Logger;
    /**
     * Log debug message
     */
    debug(message: string, context?: LogContext): void;
    /**
     * Log info message
     */
    info(message: string, context?: LogContext): void;
    /**
     * Log warning message
     */
    warn(message: string, context?: LogContext): void;
    /**
     * Log error message
     */
    error(message: string, error?: Error, context?: LogContext): void;
    /**
     * Log with timing
     */
    time<T>(label: string, fn: () => T | Promise<T>, context?: LogContext): Promise<T>;
    /**
     * Internal log method
     */
    private log;
}
/**
 * Global logger instance
 */
export declare const logger: Logger;
/**
 * Create a logger with default context for a specific component
 */
export declare function createLogger(component: string, context?: LogContext): Logger;
