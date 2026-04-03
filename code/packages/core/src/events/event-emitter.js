"use strict";
/**
 * Enhanced Event Emitter Implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalEventEmitter = exports.EventEmitter = void 0;
const logger_1 = require("../logger");
const logger = (0, logger_1.createLogger)('EventEmitter');
/**
 * Enhanced Event Emitter with logging and error handling
 */
class EventEmitter {
    listeners;
    globalListeners;
    logger;
    constructor() {
        this.listeners = new Map();
        this.globalListeners = new Set();
        this.logger = logger;
    }
    /**
     * Subscribe to events of a specific type
     */
    on(eventType, handler) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType).add(handler);
        this.logger.debug('Event listener added', { eventType });
    }
    /**
     * Unsubscribe from events of a specific type
     */
    off(eventType, handler) {
        const callbacks = this.listeners.get(eventType);
        if (callbacks) {
            callbacks.delete(handler);
            this.logger.debug('Event listener removed', { eventType });
        }
    }
    /**
     * Emit an event to all subscribers
     */
    async emit(event) {
        this.logger.debug('Emitting event', {
            type: event.type,
            sessionId: event.sessionId,
        });
        // Notify specific event listeners
        const callbacks = this.listeners.get(event.type);
        if (callbacks) {
            const promises = Array.from(callbacks).map(async (handler) => {
                try {
                    await handler(event);
                }
                catch (error) {
                    this.logger.error('Event handler error', error instanceof Error ? error : new Error(String(error)), { eventType: event.type });
                }
            });
            await Promise.all(promises);
        }
        // Notify global listeners
        const globalPromises = Array.from(this.globalListeners).map(async (handler) => {
            try {
                await handler(event);
            }
            catch (error) {
                this.logger.error('Global event handler error', error instanceof Error ? error : new Error(String(error)), { eventType: event.type });
            }
        });
        await Promise.all(globalPromises);
    }
    /**
     * Subscribe to all events
     */
    onAll(handler) {
        this.globalListeners.add(handler);
        this.logger.debug('Global event listener added');
    }
    /**
     * Unsubscribe from all events
     */
    offAll(handler) {
        this.globalListeners.delete(handler);
        this.logger.debug('Global event listener removed');
    }
    /**
     * Remove all listeners
     */
    clear() {
        this.listeners.clear();
        this.globalListeners.clear();
        this.logger.debug('All event listeners cleared');
    }
    /**
     * Get listener count for an event type
     */
    listenerCount(eventType) {
        return this.listeners.get(eventType)?.size || 0;
    }
    /**
     * Get total listener count
     */
    totalListenerCount() {
        let total = this.globalListeners.size;
        for (const callbacks of this.listeners.values()) {
            total += callbacks.size;
        }
        return total;
    }
    /**
     * Get event types with listeners
     */
    getActiveEventTypes() {
        return Array.from(this.listeners.keys()).filter(eventType => this.listeners.get(eventType).size > 0);
    }
}
exports.EventEmitter = EventEmitter;
/**
 * Create a singleton global event emitter
 */
exports.globalEventEmitter = new EventEmitter();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnQtZW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImV2ZW50LWVtaXR0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUFJSCxzQ0FBaUQ7QUFFakQsTUFBTSxNQUFNLEdBQUcsSUFBQSxxQkFBWSxFQUFDLGNBQWMsQ0FBQyxDQUFDO0FBRTVDOztHQUVHO0FBQ0gsTUFBYSxZQUFZO0lBQ2YsU0FBUyxDQUFvQztJQUM3QyxlQUFlLENBQW9CO0lBQ25DLE1BQU0sQ0FBUztJQUV2QjtRQUNFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUMzQixJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7UUFDakMsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7SUFDdkIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsRUFBRSxDQUFDLFNBQW9CLEVBQUUsT0FBcUI7UUFDNUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7WUFDbkMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQztRQUMzQyxDQUFDO1FBQ0QsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFFLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzVDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLHNCQUFzQixFQUFFLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztJQUMzRCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxHQUFHLENBQUMsU0FBb0IsRUFBRSxPQUFxQjtRQUM3QyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNoRCxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2QsU0FB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Q0FBQztJQUVEOztPQUVHO0lBQ0gsYUFBYSxDQUFDLFNBQW9CO1FBQ2hDLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsSUFBSSxJQUFJLENBQUMsQ0FBQztJQUNsRCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxrQkFBa0I7UUFDaEIsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUM7UUFDdEMsS0FBSyxNQUFNLFNBQVMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUM7WUFDaEQsS0FBSyxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDMUIsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVEOztPQUVHO0lBQ0gsbUJBQW1CO1FBQ2pCLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsTUFBTSxDQUM3QyxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBRSxDQUFDLElBQUksR0FBRyxDQUFDLENBQ3JELENBQUM7SUFDSixDQUFDO0NBQ0Y7QUE3SEQsb0NBNkhDO0FBRUQ7O0dBRUc7QUFDVSxRQUFBLGtCQUFrQixHQUFHLElBQUksWUFBWSxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEVuaGFuY2VkIEV2ZW50IEVtaXR0ZXIgSW1wbGVtZW50YXRpb25cbiAqL1xuXG5pbXBvcnQgeyBJRXZlbnRFbWl0dGVyIH0gZnJvbSAnLi9pbnRlcmZhY2UnO1xuaW1wb3J0IHsgRXZlbnRUeXBlLCBBZ2VudEV2ZW50LCBFdmVudEhhbmRsZXIgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IExvZ2dlciwgY3JlYXRlTG9nZ2VyIH0gZnJvbSAnLi4vbG9nZ2VyJztcblxuY29uc3QgbG9nZ2VyID0gY3JlYXRlTG9nZ2VyKCdFdmVudEVtaXR0ZXInKTtcblxuLyoqXG4gKiBFbmhhbmNlZCBFdmVudCBFbWl0dGVyIHdpdGggbG9nZ2luZyBhbmQgZXJyb3IgaGFuZGxpbmdcbiAqL1xuZXhwb3J0IGNsYXNzIEV2ZW50RW1pdHRlciBpbXBsZW1lbnRzIElFdmVudEVtaXR0ZXIge1xuICBwcml2YXRlIGxpc3RlbmVyczogTWFwPEV2ZW50VHlwZSwgU2V0PEV2ZW50SGFuZGxlcj4+O1xuICBwcml2YXRlIGdsb2JhbExpc3RlbmVyczogU2V0PEV2ZW50SGFuZGxlcj47XG4gIHByaXZhdGUgbG9nZ2VyOiBMb2dnZXI7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5saXN0ZW5lcnMgPSBuZXcgTWFwKCk7XG4gICAgdGhpcy5nbG9iYWxMaXN0ZW5lcnMgPSBuZXcgU2V0KCk7XG4gICAgdGhpcy5sb2dnZXIgPSBsb2dnZXI7XG4gIH1cblxuICAvKipcbiAgICogU3Vic2NyaWJlIHRvIGV2ZW50cyBvZiBhIHNwZWNpZmljIHR5cGVcbiAgICovXG4gIG9uKGV2ZW50VHlwZTogRXZlbnRUeXBlLCBoYW5kbGVyOiBFdmVudEhhbmRsZXIpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMubGlzdGVuZXJzLmhhcyhldmVudFR5cGUpKSB7XG4gICAgICB0aGlzLmxpc3RlbmVycy5zZXQoZXZlbnRUeXBlLCBuZXcgU2V0KCkpO1xuICAgIH1cbiAgICB0aGlzLmxpc3RlbmVycy5nZXQoZXZlbnRUeXBlKSEuYWRkKGhhbmRsZXIpO1xuICAgIHRoaXMubG9nZ2VyLmRlYnVnKCdFdmVudCBsaXN0ZW5lciBhZGRlZCcsIHsgZXZlbnRUeXBlIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFVuc3Vic2NyaWJlIGZyb20gZXZlbnRzIG9mIGEgc3BlY2lmaWMgdHlwZVxuICAgKi9cbiAgb2ZmKGV2ZW50VHlwZTogRXZlbnRUeXBlLCBoYW5kbGVyOiBFdmVudEhhbmRsZXIpOiB2b2lkIHtcbiAgICBjb25zdCBjYWxsYmFja3MgPSB0aGlzLmxpc3RlbmVycy5nZXQoZXZlbnRUeXBlKTtcbiAgICBpZiAoY2FsbGJhY2tzKSB7XG4gICAgICBjYWxsYmFja3MuZGVsZXRlKGhhbmRsZXIpO1xuICAgICAgdGhpcy5sb2dnZXIuZGVidWcoJ0V2ZW50IGxpc3RlbmVyIHJlbW92ZWQnLCB7IGV2ZW50VHlwZSB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRW1pdCBhbiBldmVudCB0byBhbGwgc3Vic2NyaWJlcnNcbiAgICovXG4gIGFzeW5jIGVtaXQoZXZlbnQ6IEFnZW50RXZlbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmxvZ2dlci5kZWJ1ZygnRW1pdHRpbmcgZXZlbnQnLCB7XG4gICAgICB0eXBlOiBldmVudC50eXBlLFxuICAgICAgc2Vzc2lvbklkOiBldmVudC5zZXNzaW9uSWQsXG4gICAgfSk7XG5cbiAgICAvLyBOb3RpZnkgc3BlY2lmaWMgZXZlbnQgbGlzdGVuZXJzXG4gICAgY29uc3QgY2FsbGJhY2tzID0gdGhpcy5saXN0ZW5lcnMuZ2V0KGV2ZW50LnR5cGUpO1xuICAgIGlmIChjYWxsYmFja3MpIHtcbiAgICAgIGNvbnN0IHByb21pc2VzID0gQXJyYXkuZnJvbShjYWxsYmFja3MpLm1hcChhc3luYyBoYW5kbGVyID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBoYW5kbGVyKGV2ZW50KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICB0aGlzLmxvZ2dlci5lcnJvcihcbiAgICAgICAgICAgICdFdmVudCBoYW5kbGVyIGVycm9yJyxcbiAgICAgICAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvciA6IG5ldyBFcnJvcihTdHJpbmcoZXJyb3IpKSxcbiAgICAgICAgICAgIHsgZXZlbnRUeXBlOiBldmVudC50eXBlIH1cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcbiAgICB9XG5cbiAgICAvLyBOb3RpZnkgZ2xvYmFsIGxpc3RlbmVyc1xuICAgIGNvbnN0IGdsb2JhbFByb21pc2VzID0gQXJyYXkuZnJvbSh0aGlzLmdsb2JhbExpc3RlbmVycykubWFwKGFzeW5jIGhhbmRsZXIgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgaGFuZGxlcihldmVudCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICB0aGlzLmxvZ2dlci5lcnJvcihcbiAgICAgICAgICAnR2xvYmFsIGV2ZW50IGhhbmRsZXIgZXJyb3InLFxuICAgICAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvciA6IG5ldyBFcnJvcihTdHJpbmcoZXJyb3IpKSxcbiAgICAgICAgICB7IGV2ZW50VHlwZTogZXZlbnQudHlwZSB9XG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoZ2xvYmFsUHJvbWlzZXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFN1YnNjcmliZSB0byBhbGwgZXZlbnRzXG4gICAqL1xuICBvbkFsbChoYW5kbGVyOiBFdmVudEhhbmRsZXIpOiB2b2lkIHtcbiAgICB0aGlzLmdsb2JhbExpc3RlbmVycy5hZGQoaGFuZGxlcik7XG4gICAgdGhpcy5sb2dnZXIuZGVidWcoJ0dsb2JhbCBldmVudCBsaXN0ZW5lciBhZGRlZCcpO1xuICB9XG5cbiAgLyoqXG4gICAqIFVuc3Vic2NyaWJlIGZyb20gYWxsIGV2ZW50c1xuICAgKi9cbiAgb2ZmQWxsKGhhbmRsZXI6IEV2ZW50SGFuZGxlcik6IHZvaWQge1xuICAgIHRoaXMuZ2xvYmFsTGlzdGVuZXJzLmRlbGV0ZShoYW5kbGVyKTtcbiAgICB0aGlzLmxvZ2dlci5kZWJ1ZygnR2xvYmFsIGV2ZW50IGxpc3RlbmVyIHJlbW92ZWQnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIGxpc3RlbmVyc1xuICAgKi9cbiAgY2xlYXIoKTogdm9pZCB7XG4gICAgdGhpcy5saXN0ZW5lcnMuY2xlYXIoKTtcbiAgICB0aGlzLmdsb2JhbExpc3RlbmVycy5jbGVhcigpO1xuICAgIHRoaXMubG9nZ2VyLmRlYnVnKCdBbGwgZXZlbnQgbGlzdGVuZXJzIGNsZWFyZWQnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgbGlzdGVuZXIgY291bnQgZm9yIGFuIGV2ZW50IHR5cGVcbiAgICovXG4gIGxpc3RlbmVyQ291bnQoZXZlbnRUeXBlOiBFdmVudFR5cGUpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmxpc3RlbmVycy5nZXQoZXZlbnRUeXBlKT8uc2l6ZSB8fCAwO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0b3RhbCBsaXN0ZW5lciBjb3VudFxuICAgKi9cbiAgdG90YWxMaXN0ZW5lckNvdW50KCk6IG51bWJlciB7XG4gICAgbGV0IHRvdGFsID0gdGhpcy5nbG9iYWxMaXN0ZW5lcnMuc2l6ZTtcbiAgICBmb3IgKGNvbnN0IGNhbGxiYWNrcyBvZiB0aGlzLmxpc3RlbmVycy52YWx1ZXMoKSkge1xuICAgICAgdG90YWwgKz0gY2FsbGJhY2tzLnNpemU7XG4gICAgfVxuICAgIHJldHVybiB0b3RhbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgZXZlbnQgdHlwZXMgd2l0aCBsaXN0ZW5lcnNcbiAgICovXG4gIGdldEFjdGl2ZUV2ZW50VHlwZXMoKTogRXZlbnRUeXBlW10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMubGlzdGVuZXJzLmtleXMoKSkuZmlsdGVyKFxuICAgICAgZXZlbnRUeXBlID0+IHRoaXMubGlzdGVuZXJzLmdldChldmVudFR5cGUpIS5zaXplID4gMFxuICAgICk7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBzaW5nbGV0b24gZ2xvYmFsIGV2ZW50IGVtaXR0ZXJcbiAqL1xuZXhwb3J0IGNvbnN0IGdsb2JhbEV2ZW50RW1pdHRlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiJdfQ==