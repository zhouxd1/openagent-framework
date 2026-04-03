import { describe, test, expect, beforeEach, vi } from 'vitest';
import { createObservability } from '../src';

describe('createObservability', () => {
  test('should create tracer, metrics, and logger', () => {
    const { tracer, metrics, logger } = createObservability({
      serviceName: 'test-service',
    });

    expect(tracer).toBeDefined();
    expect(metrics).toBeDefined();
    expect(logger).toBeDefined();
  });

  test('should create with tracing config', () => {
    const { tracer } = createObservability({
      serviceName: 'test-service',
      tracing: {
        enabled: true,
        samplingRate: 1.0,
        exporter: 'console',
      },
    });

    expect(tracer).toBeDefined();
  });

  test('should create with metrics config', () => {
    const { metrics } = createObservability({
      serviceName: 'test-service',
      metrics: {
        enabled: true,
        exporter: 'prometheus',
        defaultLabels: {
          env: 'test',
        },
      },
    });

    expect(metrics).toBeDefined();
  });

  test('should create with logging config', () => {
    const { logger } = createObservability({
      serviceName: 'test-service',
      logging: {
        level: 'debug',
        format: 'json',
        context: {
          version: '1.0.0',
        },
      },
    });

    expect(logger).toBeDefined();
    expect(logger.getLevel()).toBe('debug');
  });

  test('should create with complete config', () => {
    const obs = createObservability({
      serviceName: 'complete-service',
      tracing: {
        samplingRate: 0.5,
      },
      metrics: {
        defaultLabels: {
          service: 'complete-service',
        },
      },
      logging: {
        level: 'info',
      },
    });

    expect(obs.tracer).toBeDefined();
    expect(obs.metrics).toBeDefined();
    expect(obs.logger).toBeDefined();
  });
});
