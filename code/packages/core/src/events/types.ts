/**
 * Event Types for OpenAgent Framework
 */

import { Metadata } from '../types';

/**
 * Event types enum
 */
export enum EventType {
  // Agent events
  AGENT_START = 'agent:start',
  AGENT_END = 'agent:end',
  AGENT_ERROR = 'agent:error',

  // Tool events
  TOOL_START = 'tool:start',
  TOOL_END = 'tool:end',
  TOOL_ERROR = 'tool:error',

  // Session events
  SESSION_CREATED = 'session:created',
  SESSION_UPDATED = 'session:updated',
  SESSION_CLOSED = 'session:closed',

  // Message events
  MESSAGE_CREATED = 'message:created',

  // Error events
  ERROR = 'error',

  // LLM events
  LLM_REQUEST = 'llm:request',
  LLM_RESPONSE = 'llm:response',
  LLM_ERROR = 'llm:error',

  // Permission events
  PERMISSION_CHECKED = 'permission:checked',
  PERMISSION_DENIED = 'permission:denied',
}

/**
 * Agent event structure
 */
export interface AgentEvent {
  type: EventType;
  sessionId?: string;
  agentId?: string;
  timestamp: Date;
  data: unknown;
  metadata?: Metadata;
}

/**
 * Event handler function type
 */
export type EventHandler = (event: AgentEvent) => void | Promise<void>;
