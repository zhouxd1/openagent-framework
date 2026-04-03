/**
 * Enhanced Event Emitter Implementation
 */
import { IEventEmitter } from './interface';
import { EventType, AgentEvent, EventHandler } from './types';
/**
 * Enhanced Event Emitter with logging and error handling
 */
export declare class EventEmitter implements IEventEmitter {
    private listeners;
    private globalListeners;
    private logger;
    constructor();
    /**
     * Subscribe to events of a specific type
     */
    on(eventType: EventType, handler: EventHandler): void;
    /**
     * Unsubscribe from events of a specific type
     */
    off(eventType: EventType, handler: EventHandler): void;
    /**
     * Emit an event to all subscribers
     */
    emit(event: AgentEvent): Promise<void>;
    /**
     * Subscribe to all events
     */
    onAll(handler: EventHandler): void;
    /**
     * Unsubscribe from all events
     */
    offAll(handler: EventHandler): void;
    /**
     * Remove all listeners
     */
    clear(): void;
    /**
     * Get listener count for an event type
     */
    listenerCount(eventType: EventType): number;
    /**
     * Get total listener count
     */
    totalListenerCount(): number;
    /**
     * Get event types with listeners
     */
    getActiveEventTypes(): EventType[];
}
/**
 * Create a singleton global event emitter
 */
export declare const globalEventEmitter: EventEmitter;
