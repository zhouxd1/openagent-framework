/**
 * Log levels in order of severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log level utilities
 */
export class LogLevelUtils {
  private static readonly levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

  /**
   * Check if a log level should be logged based on the minimum level
   */
  static shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
    return this.levels.indexOf(level) >= this.levels.indexOf(minLevel);
  }

  /**
   * Get the numeric value of a log level
   */
  static getLevelValue(level: LogLevel): number {
    return this.levels.indexOf(level);
  }

  /**
   * Get all log levels
   */
  static getAllLevels(): LogLevel[] {
    return [...this.levels];
  }

  /**
   * Parse a string to a log level
   */
  static parseLevel(value: string): LogLevel | undefined {
    const normalized = value.toLowerCase();
    if (this.levels.includes(normalized as LogLevel)) {
      return normalized as LogLevel;
    }
    return undefined;
  }

  /**
   * Compare two log levels
   * Returns: negative if a < b, zero if a == b, positive if a > b
   */
  static compare(a: LogLevel, b: LogLevel): number {
    return this.levels.indexOf(a) - this.levels.indexOf(b);
  }
}
