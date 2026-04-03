import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Tracer } from '../src/tracing/tracer';
import { ConsoleSpanExporter } from '../src/tracing/exporters/console';
import { SpanUtils } from '../src/tracing/span';
import { ContextManager } from '../src/tracing/context';

describe('Tracer', () => {
  let tracer: Tracer;
  let exporter: ConsoleSpanExporter;

  beforeEach(() => {
    exporter = new ConsoleSpanExporter({ prettyPrint: false });
    tracer = new Tracer({
      name: 'test-tracer',
      exporter,
    });
  });

  describe('startSpan', () => {
    test('should create a span with basic properties', () => {
      const span = tracer.startSpan('test-operation');

      expect(span.name).toBe('test-operation');
      expect(span.traceId).toBeDefined();
      expect(span.id).toBeDefined();
      expect(span.startTime).toBeDefined();
      expect(span.status.code).toBe('UNSET');
      expect(span.attributes).toEqual({});
      expect(span.events).toEqual([]);
    });

    test('should create span with initial attributes', () => {
      const span = tracer.startSpan('test-operation', {
        attributes: { 'user.id': '123', 'operation.type': 'read' },
      });

      expect(span.attributes).toEqual({
        'user.id': '123',
        'operation.type': 'read',
      });
    });

    test('should create child span with parent context', async () => {
      const parentSpan = await tracer.withSpan('parent', async (parent) => {
        const childSpan = tracer.startSpan('child');
        expect(childSpan.parentSpanId).toBe(parent.id);
        expect(childSpan.traceId).toBe(parent.traceId);
        return parent;
      });

      expect(parentSpan.id).toBeDefined();
    });
  });

  describe('withSpan', () => {
    test('should execute function and return result', async () => {
      const result = await tracer.withSpan('test-async', async (span) => {
        tracer.setAttribute(span, 'test.attr', 'value');
        return 'success';
      });

      expect(result).toBe('success');
    });

    test('should set status to OK on success', async () => {
      let capturedSpan: any;

      await tracer.withSpan('test-success', async (span) => {
        capturedSpan = span;
        return 'done';
      });

      expect(capturedSpan.status.code).toBe('OK');
      expect(capturedSpan.endTime).toBeDefined();
    });

    test('should capture exceptions', async () => {
      await expect(
        tracer.withSpan('test-error', async (span) => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });

    test('should record exception in span', async () => {
      let capturedSpan: any;

      try {
        await tracer.withSpan('test-exception', async (span) => {
          capturedSpan = span;
          throw new Error('Test exception');
        });
      } catch (e) {
        // Expected
      }

      expect(capturedSpan.status.code).toBe('ERROR');
      expect(capturedSpan.status.message).toBe('Test exception');
      expect(capturedSpan.events).toHaveLength(1);
      expect(capturedSpan.events[0].name).toBe('exception');
    });

    test('should always end span and export', async () => {
      const exportSpy = vi.spyOn(exporter, 'export');

      try {
        await tracer.withSpan('test-always', async () => {
          throw new Error('Force error');
        });
      } catch (e) {
        // Expected
      }

      expect(exportSpy).toHaveBeenCalled();
    });
  });

  describe('addEvent', () => {
    test('should add event to span', () => {
      const span = tracer.startSpan('test-event');
      tracer.addEvent(span, 'something-happened', { key: 'value' });

      expect(span.events).toHaveLength(1);
      expect(span.events[0].name).toBe('something-happened');
      expect(span.events[0].attributes).toEqual({ key: 'value' });
      expect(span.events[0].timestamp).toBeDefined();
    });
  });

  describe('setAttribute', () => {
    test('should set attribute on span', () => {
      const span = tracer.startSpan('test-attr');
      tracer.setAttribute(span, 'user.id', '123');

      expect(span.attributes['user.id']).toBe('123');
    });

    test('should set multiple attributes', () => {
      const span = tracer.startSpan('test-multi-attr');
      tracer.setAttributes(span, {
        'user.id': '123',
        'request.id': 'abc',
      });

      expect(span.attributes).toEqual({
        'user.id': '123',
        'request.id': 'abc',
      });
    });
  });

  describe('sampling', () => {
    test('should respect sampling rate', () => {
      const noOpTracer = new Tracer({
        name: 'no-op-tracer',
        exporter,
        samplingRate: 0,
      });

      const span = noOpTracer.startSpan('should-be-noop');
      expect(span.id).toBe('noop');
      expect(span.traceId).toBe('noop');
    });

    test('should sample when rate is 1', () => {
      const fullTracer = new Tracer({
        name: 'full-tracer',
        exporter,
        samplingRate: 1,
      });

      const span = fullTracer.startSpan('should-be-sampled');
      expect(span.id).not.toBe('noop');
    });
  });
});

describe('SpanUtils', () => {
  test('should end span', () => {
    const span = {
      id: '1',
      traceId: 't1',
      name: 'test',
      startTime: Date.now(),
      attributes: {},
      events: [],
      status: { code: 'UNSET' as const },
    };

    SpanUtils.end(span);
    expect(span.endTime).toBeDefined();
  });

  test('should calculate duration', () => {
    const span = {
      id: '1',
      traceId: 't1',
      name: 'test',
      startTime: 1000,
      endTime: 2000,
      attributes: {},
      events: [],
      status: { code: 'OK' as const },
    };

    expect(SpanUtils.getDuration(span)).toBe(1000);
  });

  test('should record exception', () => {
    const span = {
      id: '1',
      traceId: 't1',
      name: 'test',
      startTime: Date.now(),
      attributes: {},
      events: [],
      status: { code: 'UNSET' as const },
    };

    const error = new Error('Test error');
    SpanUtils.recordException(span, error);

    expect(span.status.code).toBe('ERROR');
    expect(span.events).toHaveLength(1);
    expect(span.events[0].name).toBe('exception');
  });
});

describe('ContextManager', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager();
  });

  test('should manage active context', () => {
    expect(contextManager.getActive()).toBeUndefined();

    contextManager.setActive({ traceId: 't1', spanId: 's1' });
    expect(contextManager.getActive()).toEqual({ traceId: 't1', spanId: 's1' });
  });

  test('should maintain stack of contexts', () => {
    contextManager.setActive({ traceId: 't1', spanId: 's1' });
    contextManager.setActive({ traceId: 't1', spanId: 's2' });

    expect(contextManager.depth).toBe(2);
    expect(contextManager.getActive()?.spanId).toBe('s2');

    contextManager.restore();
    expect(contextManager.depth).toBe(1);
    expect(contextManager.getActive()?.spanId).toBe('s1');
  });

  test('should clear all contexts', () => {
    contextManager.setActive({ traceId: 't1', spanId: 's1' });
    contextManager.setActive({ traceId: 't1', spanId: 's2' });

    contextManager.clear();
    expect(contextManager.depth).toBe(0);
    expect(contextManager.getActive()).toBeUndefined();
  });
});
