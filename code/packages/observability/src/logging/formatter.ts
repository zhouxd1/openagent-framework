import { LogEntry } from './logger';

/**
 * Formatter interface for log entries
 */
export interface Formatter {
  /**
   * Format a log entry
   */
  format(entry: LogEntry): string;
}

/**
 * JsonFormatter formats log entries as JSON
 */
export class JsonFormatter implements Formatter {
  /**
   * Format entry as JSON
   */
  format(entry: LogEntry): string {
    return JSON.stringify(entry);
  }
}

/**
 * TextFormatter formats log entries as human-readable text
 */
export class TextFormatter implements Formatter {
  private colorize: boolean;

  constructor(options?: { colorize?: boolean }) {
    this.colorize = options?.colorize ?? false;
  }

  /**
   * Format entry as text
   */
  format(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = this.formatLevel(entry.level);
    const logger = `[${entry.logger}]`;
    const message = entry.message;

    // Extract metadata (everything except standard fields)
    const meta = Object.entries(entry)
      .filter(([key]) => !['timestamp', 'level', 'logger', 'message'].includes(key))
      .map(([key, value]) => `${key}=${this.serializeValue(value)}`)
      .join(' ');

    const parts = [timestamp, level, logger, message];
    if (meta) {
      parts.push(meta);
    }

    return parts.join(' ').trim();
  }

  /**
   * Format the log level with optional colors
   */
  private formatLevel(level: string): string {
    const padded = level.toUpperCase().padEnd(5);
    
    if (this.colorize) {
      const colors: Record<string, string> = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m', // Red
      };
      const reset = '\x1b[0m';
      return `${colors[level] || ''}${padded}${reset}`;
    }

    return padded;
  }

  /**
   * Serialize a value for display
   */
  private serializeValue(value: any): string {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }
}

/**
 * PrettyFormatter formats log entries with indentation and colors
 */
export class PrettyFormatter implements Formatter {
  /**
   * Format entry with pretty printing
   */
  format(entry: LogEntry): string {
    const lines: string[] = [];
    
    // Header line
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase();
    lines.push(`[${timestamp}] ${level} [${entry.logger}]`);
    
    // Message
    lines.push(`  Message: ${entry.message}`);
    
    // Metadata
    const meta = Object.entries(entry)
      .filter(([key]) => !['timestamp', 'level', 'logger', 'message'].includes(key));
    
    if (meta.length > 0) {
      lines.push('  Metadata:');
      for (const [key, value] of meta) {
        lines.push(`    ${key}: ${JSON.stringify(value)}`);
      }
    }
    
    return lines.join('\n');
  }
}
