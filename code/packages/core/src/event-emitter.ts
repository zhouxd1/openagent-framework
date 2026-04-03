/**
 * Event Emitter Implementation
 */

import { IEventEmitter, EventCallback, Event, EventType } from './interfaces';

export class EventEmitter implements IEventEmitter {
  private listeners: Map<EventType, Set<EventCallback>>;
  private globalListeners: Set<EventCallback>;

  constructor() {
    this.listeners = new Map();
    this.globalListeners = new Set();
  }

  on(eventType: EventType, callback: EventCallback): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
  }

  off(eventType: EventType, callback: EventCallback): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  async emit(event: Event): Promise<void> {
    // Notify specific event listeners
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      const promises = Array.from(callbacks).map(callback => callback(event));
      await Promise.all(promises);
    }

    // Notify global listeners
    const globalPromises = Array.from(this.globalListeners).map(callback =>
      callback(event)
    );
    await Promise.all(globalPromises);
  }

  onAll(callback: EventCallback): void {
    this.globalListeners.add(callback);
  }

  /**
   * Remove all listeners
   */
  clear(): void {
    this.listeners.clear();
    this.globalListeners.clear();
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
}

/**
 * Create a singleton event emitter
 */
export const globalEventEmitter = new EventEmitter();
