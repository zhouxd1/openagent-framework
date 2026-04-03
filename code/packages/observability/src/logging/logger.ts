import { LogLevel } from './level';
import { LogLevelUtils } from './level';
import { Transport, ConsoleTransport } from './transport';

/**
 * Log entry structure
 */
export interface LogEntry {
  /** Timestamp of the log entry */
  timestamp: Date;
  /** Log level */
  level: LogLevel;
  /** Logger name */
  logger: string;
  /** Log message */
  message: string;
  /** Additional metadata */
  [key: string]: any;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Logger name */
  name: string;
  /** Minimum log level */
  level?: LogLevel;
  /** Transport destinations */
  transports?: Transport[];
  /** Default context/metadata */
  context?: Record<string, any>;
}

/**
 * Logger provides structured logging with multiple transports
 */
export class Logger {
  private name: string;
  private level: LogLevel;
  private transports: Transport[];
  private context: Record<string, any>;

  constructor(config: LoggerConfig) {
    this.name = config.name;
    this.level = config.level || 'info';
    this.transports = config.transports || [new ConsoleTransport()];
    this.context = config.context || {};
  }

  /**
   * Log a debug message
   */
  debug(message: string, meta?: Record<string, any>): void {
    this.log('debug', message, meta);
  }

  /**
   * Log an info message
   */
  info(message: string, meta?: Record<string, any>): void {
    this.log('info', message, meta);
  }

  /**
   * Log a warning message
   */
  warn(message: string, meta?: Record<string, any>): void {
    this.log('warn', message, meta);
  }

  /**
   * Log an error message
   */
  error(message: string, meta?: Record<string, any>): void {
    this.log('error', message, meta);
  }

  /**
   * Log a message at the specified level
   */
  log(level: LogLevel, message: string, meta?: Record<string, any>): void {
    // Check if this level should be logged
    if (!this.shouldLog(level)) {
      return;
    }

    // Build the log entry
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      logger: this.name,
      message,
      ...this.context,
      ...meta,
    };

    // Send to all transports
    for (const transport of this.transports) {
      try {
        transport.log(entry);
      } catch (error) {
        // Don't let transport errors stop logging
        console.error('Transport error:', error);
      }
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    return new Logger({
      name: this.name,
      level: this.level,
      transports: this.transports,
      context: { ...this.context, ...context },
    });
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Add a transport
   */
  addTransport(transport: Transport): void {
    this.transports.push(transport);
  }

  /**
   * Remove a transport
   */
  removeTransport(transport: Transport): void {
    const index = this.transports.indexOf(transport);
    if (index > -1) {
      this.transports.splice(index, 1);
    }
  }

  /**
   * Set context metadata
   */
  setContext(context: Record<string, any>): void {
    this.context = { ...context };
  }

  /**
   * Add context metadata
   */
  addContext(context: Record<string, any>): void {
    Object.assign(this.context, context);
  }

  /**
   * Clear context metadata
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Flush all transports
   */
  async flush(): Promise<void> {
    await Promise.all(
      this.transports
        .filter((t) => t.flush)
        .map((t) => t.flush!())
    );
  }

  /**
   * Close all transports
   */
  async close(): Promise<void> {
    await Promise.all(
      this.transports
        .filter((t) => t.close)
        .map((t) => t.close!())
    );
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LogLevelUtils.shouldLog(level, this.level);
  }

  /**
   * Create a logger with a specific context value
   */
  withContext(key: string, value: any): Logger {
    return this.child({ [key]: value });
  }

  /**
   * Log with a timed duration
   */
  async time<T>(
    level: LogLevel,
    message: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.log(level, message, { duration: `${duration}ms` });
      return result;
    } catch (error: any) {
      const duration = Date.now() - start;
      this.error(message, {
        duration: `${duration}ms`,
        error: error.message,
      });
      throw error;
    }
  }
}
