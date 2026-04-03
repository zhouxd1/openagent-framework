import { LogEntry } from './logger';
import { Formatter, JsonFormatter } from './formatter';

/**
 * Transport interface for log output
 */
export interface Transport {
  /**
   * Write a log entry
   */
  log(entry: LogEntry): void;

  /**
   * Flush any buffered logs
   */
  flush?(): Promise<void>;

  /**
   * Close the transport
   */
  close?(): Promise<void>;
}

/**
 * ConsoleTransport logs to console
 */
export class ConsoleTransport implements Transport {
  private formatter: Formatter;
  private stream: 'stdout' | 'stderr';

  constructor(options?: {
    formatter?: Formatter;
    stream?: 'stdout' | 'stderr';
  }) {
    this.formatter = options?.formatter || new JsonFormatter();
    this.stream = options?.stream || 'stdout';
  }

  /**
   * Write log entry to console
   */
  log(entry: LogEntry): void {
    const formatted = this.formatter.format(entry);

    // Use stderr for errors and warnings, stdout for others
    if (entry.level === 'error' || entry.level === 'warn') {
      console.error(formatted);
    } else if (this.stream === 'stderr') {
      console.error(formatted);
    } else {
      console.log(formatted);
    }
  }
}

/**
 * FileTransport logs to a file
 * Note: In a browser environment, this would need to be adapted
 */
export class FileTransport implements Transport {
  private formatter: Formatter;
  private filePath: string;
  private buffer: LogEntry[] = [];
  private bufferSize: number;
  private flushInterval: number | null = null;

  constructor(options: {
    filePath: string;
    formatter?: Formatter;
    bufferSize?: number;
    flushIntervalMs?: number;
  }) {
    this.filePath = options.filePath;
    this.formatter = options.formatter || new JsonFormatter();
    this.bufferSize = options.bufferSize || 100;

    // Setup periodic flush
    if (options.flushIntervalMs) {
      this.flushInterval = setInterval(() => {
        this.flush();
      }, options.flushIntervalMs) as any;
    }
  }

  /**
   * Buffer log entry
   */
  log(entry: LogEntry): void {
    this.buffer.push(entry);

    // Auto-flush when buffer is full
    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  /**
   * Flush buffer to file
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      const lines = entries.map((e) => this.formatter.format(e)).join('\n') + '\n';
      
      // In Node.js, we'd use fs.appendFile
      // For now, we'll just log that we would write to the file
      // In a real implementation, this would use the fs module
      console.log(`[FileTransport] Would write to ${this.filePath}:`, lines);
    } catch (error) {
      console.error('Failed to write log file:', error);
    }
  }

  /**
   * Close the transport and flush remaining logs
   */
  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }
}

/**
 * MemoryTransport stores logs in memory (useful for testing)
 */
export class MemoryTransport implements Transport {
  private entries: LogEntry[] = [];
  private maxSize: number;

  constructor(options?: { maxSize?: number }) {
    this.maxSize = options?.maxSize || 1000;
  }

  /**
   * Store log entry in memory
   */
  log(entry: LogEntry): void {
    this.entries.push(entry);

    // Remove old entries if we exceed max size
    if (this.entries.length > this.maxSize) {
      this.entries.shift();
    }
  }

  /**
   * Get all stored entries
   */
  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  /**
   * Clear all stored entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Get entries filtered by level
   */
  getByLevel(level: string): LogEntry[] {
    return this.entries.filter((e) => e.level === level);
  }

  /**
   * Search entries by message content
   */
  search(query: string): LogEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.entries.filter((e) =>
      e.message.toLowerCase().includes(lowerQuery)
    );
  }
}
