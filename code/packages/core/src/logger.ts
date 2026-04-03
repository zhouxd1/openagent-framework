/**
 * Unified Logging System
 * 
 * Provides structured logging with multiple levels, transports, and context support.
 */

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
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
export class ConsoleTransport implements LogTransport {
  private useColors: boolean;

  constructor(useColors: boolean = true) {
    this.useColors = useColors && process.stdout.isTTY;
  }

  log(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level].padEnd(5);
    const contextStr = entry.context
      ? ' ' + JSON.stringify(this.sanitizeContext(entry.context))
      : '';
    const errorStr = entry.error
      ? `\n  Error: ${entry.error.message}\n  Stack: ${entry.error.stack}`
      : '';

    const message = `[${timestamp}] [${levelStr}] ${entry.message}${contextStr}${errorStr}`;

    if (this.useColors) {
      const colors = {
        [LogLevel.DEBUG]: '\x1b[36m', // Cyan
        [LogLevel.INFO]: '\x1b[32m',  // Green
        [LogLevel.WARN]: '\x1b[33m',  // Yellow
        [LogLevel.ERROR]: '\x1b[31m', // Red
      };
      const reset = '\x1b[0m';
      console.log(`${colors[entry.level]}${message}${reset}`);
    } else {
      console.log(message);
    }
  }

  private sanitizeContext(context: LogContext): Record<string, any> {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(context)) {
      // Mask sensitive fields
      if (['password', 'apikey', 'token', 'secret'].includes(key.toLowerCase())) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = JSON.stringify(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}

/**
 * File transport
 */
export class FileTransport implements LogTransport {
  private fs = require('fs');
  private path = require('path');

  constructor(
    private filePath: string,
    private options: {
      maxSize?: number; // Max file size in bytes
      rotateFiles?: number; // Number of rotated files to keep
    } = {}
  ) {
    // Ensure directory exists
    const dir = this.path.dirname(filePath);
    if (!this.fs.existsSync(dir)) {
      this.fs.mkdirSync(dir, { recursive: true });
    }
  }

  async log(entry: LogEntry): Promise<void> {
    const logLine = JSON.stringify({
      timestamp: entry.timestamp.toISOString(),
      level: LogLevel[entry.level],
      message: entry.message,
      context: entry.context,
      error: entry.error
        ? {
            message: entry.error.message,
            stack: entry.error.stack,
          }
        : undefined,
    }) + '\n';

    await this.appendFile(logLine);
  }

  private async appendFile(content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.fs.appendFile(this.filePath, content, (err: NodeJS.ErrnoException | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
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
export class Logger {
  private level: LogLevel;
  private transports: LogTransport[];
  private defaultContext: LogContext;

  constructor(config: LoggerConfig = {}) {
    this.level = config.level ?? LogLevel.INFO;
    this.transports = config.transports ?? [new ConsoleTransport()];
    this.defaultContext = config.defaultContext ?? {};
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Add transport
   */
  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  /**
   * Remove all transports
   */
  clearTransports(): void {
    this.transports = [];
  }

  /**
   * Create child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger({
      level: this.level,
      transports: this.transports,
      defaultContext: { ...this.defaultContext, ...context },
    });
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, undefined, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, undefined, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, undefined, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, error, context);
  }

  /**
   * Log with timing
   */
  time<T>(label: string, fn: () => T | Promise<T>, context?: LogContext): Promise<T> {
    const start = Date.now();
    this.debug(`${label} - started`, context);

    const result = fn();

    if (result instanceof Promise) {
      return result
        .then((value) => {
          const duration = Date.now() - start;
          this.debug(`${label} - completed`, { ...context, duration });
          return value;
        })
        .catch((error) => {
          const duration = Date.now() - start;
          this.error(`${label} - failed`, error, { ...context, duration });
          throw error;
        });
    } else {
      const duration = Date.now() - start;
      this.debug(`${label} - completed`, { ...context, duration });
      return Promise.resolve(result);
    }
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    error?: Error,
    context?: LogContext
  ): void {
    // Check log level
    if (level < this.level) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      context: { ...this.defaultContext, ...context },
      error,
      timestamp: new Date(),
    };

    // Send to all transports
    for (const transport of this.transports) {
      try {
        transport.log(entry);
      } catch (err) {
        // Avoid infinite loop if transport fails
        console.error('Logger transport error:', err);
      }
    }
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger();

/**
 * Create a logger with default context for a specific component
 */
export function createLogger(component: string, context?: LogContext): Logger {
  return logger.child({ component, ...context });
}
