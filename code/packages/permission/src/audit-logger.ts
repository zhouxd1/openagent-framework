/**
 * @fileoverview Audit logger for permission system
 * @module @openagent/permission/audit-logger
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AuditLog,
  AuditLogFilter,
  AuditLoggerConfig,
} from './types';

/**
 * Audit logger for tracking permission checks and changes
 */
export class AuditLogger {
  private logs: AuditLog[] = [];
  private buffer: AuditLog[] = [];
  private flushInterval?: NodeJS.Timeout;
  private config: Required<AuditLoggerConfig>;

  constructor(config?: AuditLoggerConfig) {
    this.config = {
      flushInterval: config?.flushInterval || 5000,
      bufferSize: config?.bufferSize || 100,
      enabled: config?.enabled !== false,
    };

    // Set up periodic flush
    if (this.config.enabled) {
      this.flushInterval = setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }

  /**
   * Log an audit entry
   * @param entry - Audit log entry without id and timestamp
   */
  async log(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.enabled) return;

    const auditLog: AuditLog = {
      id: this.generateId(),
      ...entry,
      timestamp: new Date(),
    };

    // Add to buffer
    this.buffer.push(auditLog);

    // Flush if buffer is full
    if (this.buffer.length >= this.config.bufferSize) {
      await this.flush();
    }
  }

  /**
   * Query audit logs
   * @param filter - Filter criteria
   * @returns Array of matching audit logs
   */
  async query(filter: AuditLogFilter): Promise<AuditLog[]> {
    // Flush buffer before querying to ensure all logs are visible
    await this.flush();

    let results = [...this.logs];

    // Apply filters
    if (filter.userId) {
      results = results.filter(log => log.userId === filter.userId);
    }

    if (filter.action) {
      results = results.filter(log => log.action === filter.action);
    }

    if (filter.resource) {
      results = results.filter(log => log.resource === filter.resource);
    }

    if (filter.result) {
      results = results.filter(log => log.result === filter.result);
    }

    if (filter.startTime) {
      results = results.filter(log => log.timestamp >= filter.startTime!);
    }

    if (filter.endTime) {
      results = results.filter(log => log.timestamp <= filter.endTime!);
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    const limit = filter.limit || 100;
    return results.slice(0, limit);
  }

  /**
   * Export audit logs to specified format
   * @param format - Export format (csv or json)
   * @returns Exported data as string
   */
  async export(format: 'csv' | 'json'): Promise<string> {
    const logs = await this.query({ limit: 10000 });

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV format
    const headers = ['id', 'userId', 'action', 'resource', 'result', 'reason', 'ip', 'userAgent', 'timestamp'];
    const rows = logs.map(log =>
      [
        log.id,
        log.userId,
        log.action,
        log.resource,
        log.result,
        log.reason || '',
        log.ip || '',
        log.userAgent || '',
        log.timestamp.toISOString(),
      ].join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Get statistics about audit logs
   */
  async getStats(): Promise<{
    totalLogs: number;
    allowCount: number;
    denyCount: number;
    topActions: Array<{ action: string; count: number }>;
    topUsers: Array<{ userId: string; count: number }>;
  }> {
    // Flush buffer before getting stats
    await this.flush();

    const logs = this.logs;

    const allowCount = logs.filter(l => l.result === 'allow').length;
    const denyCount = logs.filter(l => l.result === 'deny').length;

    // Count actions
    const actionCounts = new Map<string, number>();
    logs.forEach(log => {
      const count = actionCounts.get(log.action) || 0;
      actionCounts.set(log.action, count + 1);
    });

    const topActions = Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Count users
    const userCounts = new Map<string, number>();
    logs.forEach(log => {
      const count = userCounts.get(log.userId) || 0;
      userCounts.set(log.userId, count + 1);
    });

    const topUsers = Array.from(userCounts.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalLogs: logs.length,
      allowCount,
      denyCount,
      topActions,
      topUsers,
    };
  }

  /**
   * Clear all audit logs
   */
  async clear(): Promise<void> {
    this.logs = [];
    this.buffer = [];
  }

  /**
   * Flush buffer to storage
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const logsToFlush = [...this.buffer];
    this.buffer = [];

    try {
      // In a real implementation, this would write to a database
      // For now, we'll store in memory
      this.logs.push(...logsToFlush);
    } catch (error) {
      // If flush fails, put logs back in buffer
      this.buffer.unshift(...logsToFlush);
      console.error('Failed to flush audit logs:', error);
    }
  }

  /**
   * Generate unique audit log ID
   */
  private generateId(): string {
    return `audit_${Date.now()}_${uuidv4().replace(/-/g, '').substr(0, 9)}`;
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    // Flush remaining logs
    await this.flush();
  }
}

/**
 * Audit log formatter utilities
 */
export class AuditLogFormatter {
  /**
   * Format audit log for display
   */
  static format(log: AuditLog): string {
    const timestamp = log.timestamp.toISOString();
    const result = log.result.toUpperCase().padEnd(5);
    const user = log.userId.padEnd(20);
    const action = log.action.padEnd(20);
    const resource = log.resource;
    const reason = log.reason ? ` (${log.reason})` : '';

    return `[${timestamp}] ${result} | ${user} | ${action} | ${resource}${reason}`;
  }

  /**
   * Format multiple logs for display
   */
  static formatTable(logs: AuditLog[]): string {
    const header = 'Timestamp                   | Result | User ID              | Action               | Resource';
    const separator = '-'.repeat(100);
    const rows = logs.map(log => this.format(log));

    return [header, separator, ...rows].join('\n');
  }

  /**
   * Format log as JSON
   */
  static toJSON(log: AuditLog): string {
    return JSON.stringify(log, null, 2);
  }
}
