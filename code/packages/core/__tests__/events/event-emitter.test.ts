/**
 * Tests for EventEmitter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter, globalEventEmitter } from '../../src/events/event-emitter';
import { EventType, AgentEvent } from '../../src/events/types';

describe('EventEmitter', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  afterEach(() => {
    emitter.clear();
  });

  describe('on', () => {
    it('should subscribe to an event type', () => {
      const handler = vi.fn();
      emitter.on(EventType.AGENT_START, handler);
      expect(emitter.listenerCount(EventType.AGENT_START)).toBe(1);
    });

    it('should allow multiple handlers for same event type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on(EventType.AGENT_START, handler1);
      emitter.on(EventType.AGENT_START, handler2);
      expect(emitter.listenerCount(EventType.AGENT_START)).toBe(2);
    });

    it('should prevent duplicate handlers', () => {
      const handler = vi.fn();
      emitter.on(EventType.AGENT_START, handler);
      emitter.on(EventType.AGENT_START, handler);
      expect(emitter.listenerCount(EventType.AGENT_START)).toBe(1);
    });
  });

  describe('off', () => {
    it('should unsubscribe from an event type', () => {
      const handler = vi.fn();
      emitter.on(EventType.AGENT_START, handler);
      emitter.off(EventType.AGENT_START, handler);
      expect(emitter.listenerCount(EventType.AGENT_START)).toBe(0);
    });

    it('should handle unsubscribing non-existent handler', () => {
      const handler = vi.fn();
      expect(() => emitter.off(EventType.AGENT_START, handler)).not.toThrow();
    });
  });

  describe('emit', () => {
    it('should emit event to all subscribers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on(EventType.AGENT_START, handler1);
      emitter.on(EventType.AGENT_START, handler2);

      const event: AgentEvent = {
        type: EventType.AGENT_START,
        timestamp: new Date(),
        data: { message: 'test' },
      };

      await emitter.emit(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('should not emit to unsubscribed handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on(EventType.AGENT_START, handler1);
      emitter.on(EventType.AGENT_START, handler2);
      emitter.off(EventType.AGENT_START, handler2);

      const event: AgentEvent = {
        type: EventType.AGENT_START,
        timestamp: new Date(),
        data: { message: 'test' },
      };

      await emitter.emit(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should handle async handlers', async () => {
      const handler = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      emitter.on(EventType.AGENT_START, handler);

      const event: AgentEvent = {
        type: EventType.AGENT_START,
        timestamp: new Date(),
        data: { message: 'test' },
      };

      await emitter.emit(event);

      expect(handler).toHaveBeenCalled();
    });

    it('should handle handler errors gracefully', async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      const goodHandler = vi.fn();
      emitter.on(EventType.AGENT_START, errorHandler);
      emitter.on(EventType.AGENT_START, goodHandler);

      const event: AgentEvent = {
        type: EventType.AGENT_START,
        timestamp: new Date(),
        data: { message: 'test' },
      };

      // Should not throw even if one handler fails
      await expect(emitter.emit(event)).resolves.not.toThrow();
      expect(goodHandler).toHaveBeenCalled();
    });
  });

  describe('onAll', () => {
    it('should subscribe to all events', async () => {
      const handler = vi.fn();
      emitter.onAll(handler);

      const event1: AgentEvent = {
        type: EventType.AGENT_START,
        timestamp: new Date(),
        data: {},
      };
      const event2: AgentEvent = {
        type: EventType.TOOL_START,
        timestamp: new Date(),
        data: {},
      };

      await emitter.emit(event1);
      await emitter.emit(event2);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(event1);
      expect(handler).toHaveBeenCalledWith(event2);
    });
  });

  describe('offAll', () => {
    it('should unsubscribe from all events', async () => {
      const handler = vi.fn();
      emitter.onAll(handler);
      emitter.offAll(handler);

      const event: AgentEvent = {
        type: EventType.AGENT_START,
        timestamp: new Date(),
        data: {},
      };

      await emitter.emit(event);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should remove all listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on(EventType.AGENT_START, handler1);
      emitter.on(EventType.TOOL_START, handler2);
      emitter.clear();

      expect(emitter.totalListenerCount()).toBe(0);
    });

    it('should remove global listeners', () => {
      const handler = vi.fn();
      emitter.onAll(handler);
      emitter.clear();

      expect(emitter.totalListenerCount()).toBe(0);
    });
  });

  describe('listenerCount', () => {
    it('should return count of listeners for event type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on(EventType.AGENT_START, handler1);
      emitter.on(EventType.AGENT_START, handler2);

      expect(emitter.listenerCount(EventType.AGENT_START)).toBe(2);
    });

    it('should return 0 for event type with no listeners', () => {
      expect(emitter.listenerCount(EventType.AGENT_START)).toBe(0);
    });
  });

  describe('totalListenerCount', () => {
    it('should return total count of all listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const globalHandler = vi.fn();
      emitter.on(EventType.AGENT_START, handler1);
      emitter.on(EventType.TOOL_START, handler2);
      emitter.onAll(globalHandler);

      expect(emitter.totalListenerCount()).toBe(3);
    });
  });

  describe('getActiveEventTypes', () => {
    it('should return event types with listeners', () => {
      const handler = vi.fn();
      emitter.on(EventType.AGENT_START, handler);
      emitter.on(EventType.TOOL_START, handler);

      const activeTypes = emitter.getActiveEventTypes();

      expect(activeTypes).toContain(EventType.AGENT_START);
      expect(activeTypes).toContain(EventType.TOOL_START);
      expect(activeTypes).toHaveLength(2);
    });

    it('should return empty array when no listeners', () => {
      const activeTypes = emitter.getActiveEventTypes();
      expect(activeTypes).toHaveLength(0);
    });
  });
});

describe('globalEventEmitter', () => {
  it('should be a singleton instance', () => {
    expect(globalEventEmitter).toBeInstanceOf(EventEmitter);
  });
});
