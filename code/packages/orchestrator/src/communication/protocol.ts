/**
 * @fileoverview Communication Protocol
 * @description Defines communication protocols and message formats
 */

import { AgentMessage } from '../types';

/**
 * Message types enumeration
 */
export enum MessageType {
  TASK = 'task',
  RESULT = 'result',
  QUERY = 'query',
  RESPONSE = 'response',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
}

/**
 * Extended agent message with priority
 */
export interface ExtendedAgentMessage extends AgentMessage {
  /** Message priority */
  priority?: MessagePriority;
  /** Correlation ID for request-response patterns */
  correlationId?: string;
  /** Time-to-live in milliseconds */
  ttl?: number;
  /** Retry count */
  retryCount?: number;
}

/**
 * Protocol configuration
 */
export interface ProtocolConfig {
  /** Default message timeout in milliseconds */
  defaultTimeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Enable message acknowledgments */
  enableAck?: boolean;
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;
}

/**
 * Message factory for creating standardized messages
 */
export class MessageFactory {
  private static messageIdCounter = 0;

  /**
   * Generate a unique message ID
   */
  private static generateId(): string {
    return `msg_${Date.now()}_${++this.messageIdCounter}`;
  }

  /**
   * Create a task message
   */
  static createTaskMessage(
    from: string,
    to: string,
    payload: any,
    options?: {
      correlationId?: string;
      priority?: MessagePriority;
      ttl?: number;
    }
  ): ExtendedAgentMessage {
    return {
      id: this.generateId(),
      from,
      to,
      type: 'task',
      payload,
      timestamp: new Date(),
      correlationId: options?.correlationId,
      priority: options?.priority || MessagePriority.NORMAL,
      ttl: options?.ttl,
    };
  }

  /**
   * Create a result message
   */
  static createResultMessage(
    from: string,
    to: string,
    payload: any,
    correlationId?: string
  ): ExtendedAgentMessage {
    return {
      id: this.generateId(),
      from,
      to,
      type: 'result',
      payload,
      timestamp: new Date(),
      correlationId,
    };
  }

  /**
   * Create a query message
   */
  static createQueryMessage(
    from: string,
    to: string,
    payload: any,
    correlationId?: string
  ): ExtendedAgentMessage {
    return {
      id: this.generateId(),
      from,
      to,
      type: 'query',
      payload,
      timestamp: new Date(),
      correlationId,
    };
  }

  /**
   * Create a response message
   */
  static createResponseMessage(
    from: string,
    to: string,
    payload: any,
    correlationId: string
  ): ExtendedAgentMessage {
    return {
      id: this.generateId(),
      from,
      to,
      type: 'response',
      payload,
      timestamp: new Date(),
      correlationId,
    };
  }

  /**
   * Create an error message
   */
  static createErrorMessage(
    from: string,
    to: string,
    error: string,
    correlationId?: string
  ): ExtendedAgentMessage {
    return {
      id: this.generateId(),
      from,
      to,
      type: 'error',
      payload: { error },
      timestamp: new Date(),
      correlationId,
      priority: MessagePriority.HIGH,
    };
  }

  /**
   * Create a heartbeat message
   */
  static createHeartbeatMessage(from: string): ExtendedAgentMessage {
    return {
      id: this.generateId(),
      from,
      type: 'heartbeat',
      payload: { status: 'alive' },
      timestamp: new Date(),
    };
  }
}

/**
 * Message validator
 */
export class MessageValidator {
  /**
   * Validate a message
   */
  static validate(message: ExtendedAgentMessage): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!message.id) {
      errors.push('Message ID is required');
    }

    if (!message.from) {
      errors.push('Message sender (from) is required');
    }

    if (!message.type) {
      errors.push('Message type is required');
    }

    if (!message.timestamp) {
      errors.push('Message timestamp is required');
    }

    // Check TTL expiration
    if (message.ttl) {
      const age = Date.now() - message.timestamp.getTime();
      if (age > message.ttl) {
        errors.push('Message has expired');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Default protocol configuration
 */
export const DEFAULT_PROTOCOL_CONFIG: ProtocolConfig = {
  defaultTimeout: 30000,
  maxRetries: 3,
  enableAck: true,
  heartbeatInterval: 60000,
};
