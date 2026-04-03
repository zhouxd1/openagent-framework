/**
 * Tests for Event Emitter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter, globalEventEmitter } from '../src/event-emitter';
import { Event, EventType } from '../src/types';

describe('EventEmitter', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe('on', () => {
    it('should register event listener', () => {
      const callback = vi.fn();
      emitter.on('session.created', callback);

      expect(emitter.listenerCount('session.created')).toBe(1);
    });

    it('should register multiple listeners for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      emitter.on('session.created', callback1);
      emitter.on('session.created', callback2);

      expect(emitter.listenerCount('session.created')).toBe(2);
    });
  });

  describe('off', () => {
    it('should remove event listener', () => {
      const callback = vi.fn();
      emitter.on('session.created', callback);
      emitter.off('session.created', callback);

      expect(emitter.listenerCount('session.created')).toBe(0);
    });

    it('should not error when removing non-existent listener', () => {
      const callback = vi.fn();
      expect(() => emitter.off('session.created', callback)).not.toThrow();
    });
  });

  describe('emit', () => {
    it('should call listeners with event data', async () => {
      const callback = vi.fn();
      emitter.on('session.created', callback);

      const event: Event = {
        type: 'session.created',
        timestamp: new Date(),
        data: { sessionId: 'test-123' },
      };

      await emitter.emit(event);

      expect(callback).toHaveBeenCalledWith(event);
    });

    it('should call all listeners for an event', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      emitter.on('session.created', callback1);
      emitter.on('session.created', callback2);

      const event: Event = {
        type: 'session.created',
        timestamp: new Date(),
        data: { sessionId: 'test-123' },
      };

      await emitter.emit(event);

      expect(callback1).toHaveBeenCalledWith(event);
      expect(callback2).toHaveBeenCalledWith(event);
    });

    it('should handle async listeners', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      emitter.on('session.created', callback);

      const event: Event = {
        type: 'session.created',
        timestamp: new Date(),
        data: { sessionId: 'test-123' },
      };

      await emitter.emit(event);

      expect(callback).toHaveBeenCalledWith(event);
    });

    it('should not call listeners for different events', async () => {
      const callback = vi.fn();
      emitter.on('session.created', callback);

      const event: Event = {
        type: 'session.closed',
        timestamp: new Date(),
        data: { sessionId: 'test-123' },
      };

      await emitter.emit(event);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('onAll', () => {
    it('should register global listener for all events', async () => {
      const callback = vi.fn();
      emitter.onAll(callback);

      const event1: Event = {
        type: 'session.created',
        timestamp: new Date(),
        data: { sessionId: 'test-1' },
      };

      const event2: Event = {
        type: 'tool.called',
        timestamp: new Date(),
        data: { toolName: 'calculator' },
      };

      await emitter.emit(event1);
      await emitter.emit(event2);

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(event1);
      expect(callback).toHaveBeenCalledWith(event2);
    });
  });

  describe('clear', () => {
    it('should remove all listeners', () => {
      emitter.on('session.created', vi.fn());
      emitter.on('session.closed', vi.fn());
      emitter.onAll(vi.fn());

      emitter.clear();

      expect(emitter.totalListenerCount()).toBe(0);
    });
  });

  describe('listenerCount', () => {
    it('should return 0 for events with no listeners', () => {
      expect(emitter.listenerCount('session.created')).toBe(0);
    });

    it('should return correct count for events with listeners', () => {
      emitter.on('session.created', vi.fn());
      emitter.on('session.created', vi.fn());

      expect(emitter.listenerCount('session.created')).toBe(2);
    });
  });

  describe('totalListenerCount', () => {
    it('should count all listeners including global', () => {
      emitter.on('session.created', vi.fn());
      emitter.on('session.closed', vi.fn());
      emitter.onAll(vi.fn());

      expect(emitter.totalListenerCount()).toBe(3);
    });
  });
});

describe('globalEventEmitter', () => {
  it('should be a singleton instance', () => {
    expect(globalEventEmitter).toBeInstanceOf(EventEmitter);
  });
});
