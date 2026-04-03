/**
 * Enhanced Event Emitter Implementation
 */

import { IEventEmitter } from './interface';
import { EventType, AgentEvent, EventHandler } from './types';
import { Logger, createLogger } from '../logger';

const logger = createLogger('EventEmitter');

/**
 * Enhanced Event Emitter with logging and error handling
 */
export class EventEmitter implements IEventEmitter {
  private listeners: Map<EventType, Set<EventHandler>>;
  private globalListeners: Set<EventHandler>;
  private logger: Logger;

  constructor() {
    this.listeners = new Map();
    this.globalListeners = new Set();
    this.logger = logger;
  }

  /**
   * Subscribe to events of a specific type
   */
  on(eventType: EventType, handler: EventHandler): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);
    this.logger.debug('Event listener added', { eventType });
  }

  /**
   * Unsubscribe from events of a specific type
   */
  off(eventType: EventType, handler: EventHandler): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.delete(handler);
      this.logger.debug('Event listener removed', { eventType });
    }
  }

  /**
   * Emit an event to all subscribers
   */
  async emit(event: AgentEvent): Promise<void> {
    this.logger.debug('Emitting event', {
      type: event.type,
      sessionId: event.sessionId,
    });

    // Notify specific event listeners
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      const promises = Array.from(callbacks).map(async handler => {
        try {
          await handler(event);
        } catch (error) {
          this.logger.error(
            'Event handler error',
            error instanceof Error ? error : new Error(String(error)),
            { eventType: event.type }
          );
        }
      });
      await Promise.all(promises);
    }

    // Notify global listeners
    const globalPromises = Array.from(this.globalListeners).map(async handler => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(
          'Global event handler error',
          error instanceof Error ? error : new Error(String(error)),
          { eventType: event.type }
        );
      }
    });
    await Promise.all(globalPromises);
  }

  /**
   * Subscribe to all events
   */
  onAll(handler: EventHandler): void {
    this.globalListeners.add(handler);
    this.logger.debug('Global event listener added');
  }

  /**
   * Unsubscribe from all events
   */
  offAll(handler: EventHandler): void {
    this.globalListeners.delete(handler);
    this.logger.debug('Global event listener removed');
  }

  /**
   * Remove all listeners
   */
  clear(): void {
    this.listeners.clear();
    this.globalListeners.clear();
    this.logger.debug('All event listeners cleared');
  }

  /**
   * Get listener count for an event type
   */
  listenerCount(eventType: EventType): number {
    return this.listeners.get(eventType)?.size || 0;
  }

  /**
   * Get total listener count
   */
  totalListenerCount(): number {
    let total = this.globalListeners.size;
    for (const callbacks of this.listeners.values()) {
      total += callbacks.size;
    }
    return total;
  }

  /**
   * Get event types with listeners
   */
  getActiveEventTypes(): EventType[] {
    return Array.from(this.listeners.keys()).filter(
      eventType => this.listeners.get(eventType)!.size > 0
    );
  }
}

/**
 * Create a singleton global event emitter
 */
export const globalEventEmitter = new EventEmitter();
