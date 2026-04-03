/**
 * Event Emitter Interface for OpenAgent Framework
 */
import { EventType, AgentEvent, EventHandler } from './types';
/**
 * Event Emitter Interface
 *
 * Defines the contract for event emission and subscription
 */
export interface IEventEmitter {
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
    onAll?(handler: EventHandler): void;
    /**
     * Unsubscribe from all events
     */
    offAll?(handler: EventHandler): void;
    /**
     * Remove all listeners
     */
    clear?(): void;
    /**
     * Get listener count for an event type
     */
    listenerCount?(eventType: EventType): number;
    /**
     * Get total listener count
     */
    totalListenerCount?(): number;
}
