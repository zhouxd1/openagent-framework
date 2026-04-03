/**
 * Event Emitter Implementation
 */
import { IEventEmitter, EventCallback, Event, EventType } from './interfaces';
export declare class EventEmitter implements IEventEmitter {
    private listeners;
    private globalListeners;
    constructor();
    on(eventType: EventType, callback: EventCallback): void;
    off(eventType: EventType, callback: EventCallback): void;
    emit(event: Event): Promise<void>;
    onAll(callback: EventCallback): void;
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
}
/**
 * Create a singleton event emitter
 */
export declare const globalEventEmitter: EventEmitter;
