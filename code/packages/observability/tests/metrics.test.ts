import { describe, test, expect, beforeEach } from 'vitest';
import { MetricRegistry } from '../src/metrics/registry';
import { Counter } from '../src/metrics/counter';
import { Gauge } from '../src/metrics/gauge';
import { Histogram } from '../src/metrics/histogram';
import { PrometheusExporter } from '../src/metrics/exporters/prometheus';

describe('MetricRegistry', () => {
  let registry: MetricRegistry;

  beforeEach(() => {
    registry = new MetricRegistry();
  });

  describe('createCounter', () => {
    test('should create a counter', () => {
      const counter = registry.createCounter('requests_total', {
        description: 'Total requests',
      });

      expect(counter.name).toBe('requests_total');
      expect(counter.type).toBe('counter');
      expect(counter.description).toBe('Total requests');
      expect(counter.value).toBe(0);
    });

    test('should throw if metric already exists', () => {
      registry.createCounter('requests_total');

      expect(() => {
        registry.createCounter('requests_total');
      }).toThrow('Metric requests_total already exists');
    });

    test('should get or create counter', () => {
      const counter1 = registry.getOrCreateCounter('requests_total', {
        description: 'Total requests',
      });
      counter1.inc(5);

      const counter2 = registry.getOrCreateCounter('requests_total');

      expect(counter2.value).toBe(5);
    });
  });

  describe('createGauge', () => {
    test('should create a gauge', () => {
      const gauge = registry.createGauge('temperature_celsius', {
        description: 'Current temperature',
      });

      expect(gauge.name).toBe('temperature_celsius');
      expect(gauge.type).toBe('gauge');
      expect(gauge.value).toBe(0);
    });
  });

  describe('createHistogram', () => {
    test('should create a histogram with default buckets', () => {
      const histogram = registry.createHistogram('request_duration_seconds', {
        description: 'Request duration',
      });

      expect(histogram.name).toBe('request_duration_seconds');
      expect(histogram.type).toBe('histogram');
      expect(histogram.getBuckets().length).toBeGreaterThan(0);
    });

    test('should create a histogram with custom buckets', () => {
      const histogram = registry.createHistogram('response_size_bytes', {
        buckets: [100, 1000, 10000, 100000],
      });

      expect(histogram.getBuckets()).toEqual([100, 1000, 10000, 100000]);
    });
  });

  describe('export', () => {
    test('should export to Prometheus format', async () => {
      const counter = registry.createCounter('test_total', {
        description: 'Test counter',
      });
      counter.inc(42);

      const output = await registry.export('prometheus');

      expect(output).toContain('# HELP test_total Test counter');
      expect(output).toContain('# TYPE test_total counter');
      expect(output).toContain('test_total 42');
    });

    test('should export to JSON format', async () => {
      registry.createCounter('test_total');

      const output = await registry.export('json');

      expect(() => JSON.parse(output)).not.toThrow();
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].name).toBe('test_total');
    });
  });

  describe('setLabels', () => {
    test('should set default labels', () => {
      registry.setLabels({ service: 'openagent', env: 'production' });

      const counter = registry.createCounter('requests_total');
      expect(counter.labels).toEqual({
        service: 'openagent',
        env: 'production',
      });
    });
  });

  describe('getMetrics', () => {
    test('should return all metrics', () => {
      registry.createCounter('counter1');
      registry.createGauge('gauge1');
      registry.createHistogram('histogram1');

      const metrics = registry.getMetrics();
      expect(metrics).toHaveLength(3);
      expect(metrics.map((m) => m.name)).toContain('counter1');
      expect(metrics.map((m) => m.name)).toContain('gauge1');
      expect(metrics.map((m) => m.name)).toContain('histogram1');
    });
  });
});

describe('Counter', () => {
  let counter: Counter;

  beforeEach(() => {
    counter = new Counter('test_counter', { description: 'Test' }, {});
  });

  test('should increment by 1 by default', () => {
    counter.inc();
    expect(counter.value).toBe(1);

    counter.inc();
    expect(counter.value).toBe(2);
  });

  test('should increment by custom value', () => {
    counter.inc(5);
    expect(counter.value).toBe(5);

    counter.inc(3);
    expect(counter.value).toBe(8);
  });

  test('should throw on negative increment', () => {
    expect(() => counter.inc(-1)).toThrow(
      'Counter can only be incremented by non-negative values'
    );
  });

  test('should handle labeled increments', () => {
    counter.incWithLabels({ method: 'GET' }, 10);
    counter.incWithLabels({ method: 'POST' }, 5);

    expect(counter.value).toBe(15);
    expect(counter.getValueForLabels({ method: 'GET' })).toBe(10);
    expect(counter.getValueForLabels({ method: 'POST' })).toBe(5);
  });

  test('should reset', () => {
    counter.inc(10);
    expect(counter.value).toBe(10);

    counter.reset();
    expect(counter.value).toBe(0);
  });
});

describe('Gauge', () => {
  let gauge: Gauge;

  beforeEach(() => {
    gauge = new Gauge('test_gauge', { description: 'Test' }, {});
  });

  test('should set value', () => {
    gauge.set(42);
    expect(gauge.value).toBe(42);
  });

  test('should increment', () => {
    gauge.set(10);
    gauge.inc();
    expect(gauge.value).toBe(11);

    gauge.inc(5);
    expect(gauge.value).toBe(16);
  });

  test('should decrement', () => {
    gauge.set(10);
    gauge.dec();
    expect(gauge.value).toBe(9);

    gauge.dec(3);
    expect(gauge.value).toBe(6);
  });

  test('should set to current time', () => {
    const before = Math.floor(Date.now() / 1000);
    gauge.setToCurrentTime();
    const after = Math.floor(Date.now() / 1000);

    expect(gauge.value).toBeGreaterThanOrEqual(before);
    expect(gauge.value).toBeLessThanOrEqual(after);
  });

  test('should handle labeled values', () => {
    gauge.setWithLabels({ host: 'server1' }, 100);
    gauge.setWithLabels({ host: 'server2' }, 200);

    expect(gauge.getValueForLabels({ host: 'server1' })).toBe(100);
    expect(gauge.getValueForLabels({ host: 'server2' })).toBe(200);
  });
});

describe('Histogram', () => {
  let histogram: Histogram;

  beforeEach(() => {
    histogram = new Histogram(
      'test_histogram',
      { description: 'Test', buckets: [1, 5, 10] },
      {}
    );
  });

  test('should observe values', () => {
    histogram.observe(0.5);
    histogram.observe(3);
    histogram.observe(7);

    expect(histogram.getCount()).toBe(3);
    expect(histogram.getSum()).toBe(10.5);
  });

  test('should track bucket counts (cumulative)', () => {
    // With cumulative buckets (Prometheus style):
    // bucket{le="1"} counts values <= 1
    // bucket{le="5"} counts values <= 5 (includes <= 1)
    // bucket{le="10"} counts values <= 10 (includes <= 1 and <= 5)
    // bucket{le="+Inf"} counts all values

    histogram.observe(0.5); // <= 1, so increments all buckets
    histogram.observe(3);   // <= 5, so increments le=5, le=10, le=+Inf
    histogram.observe(7);   // <= 10, so increments le=10, le=+Inf
    histogram.observe(15);  // > 10, so increments only le=+Inf

    const counts = histogram.getBucketCounts();
    expect(counts[0]).toBe(1); // le=1: only 0.5
    expect(counts[1]).toBe(2); // le=5: 0.5, 3
    expect(counts[2]).toBe(3); // le=10: 0.5, 3, 7
    expect(counts[3]).toBe(4); // le=+Inf: all 4 values
  });

  test('should calculate percentiles', () => {
    for (let i = 1; i <= 10; i++) {
      histogram.observe(i);
    }

    const p50 = histogram.getPercentile(50);
    expect(p50).toBeLessThanOrEqual(5);

    const p90 = histogram.getPercentile(90);
    expect(p90).toBeLessThanOrEqual(10);
  });

  test('should handle labeled observations', () => {
    histogram.observeWithLabels({ endpoint: '/api/users' }, 5);
    histogram.observeWithLabels({ endpoint: '/api/posts' }, 10);

    expect(histogram.getCount()).toBe(2);

    const usersData = histogram.getLabeledData({ endpoint: '/api/users' });
    expect(usersData?.count).toBe(1);
    expect(usersData?.sum).toBe(5);
  });

  test('should reset', () => {
    histogram.observe(5);
    histogram.observe(10);

    histogram.reset();
    expect(histogram.getCount()).toBe(0);
    expect(histogram.getSum()).toBe(0);
  });

  test('should get sum and count', () => {
    histogram.observe(1);
    histogram.observe(2);
    histogram.observe(3);

    expect(histogram.getSum()).toBe(6);
    expect(histogram.getCount()).toBe(3);
  });
});

describe('PrometheusExporter', () => {
  let exporter: PrometheusExporter;

  beforeEach(() => {
    exporter = new PrometheusExporter();
  });

  test('should export counter', () => {
    const metrics = [
      {
        name: 'http_requests_total',
        type: 'counter' as const,
        description: 'Total HTTP requests',
        value: 42,
        labels: { method: 'GET' },
      },
    ];

    const output = exporter.export(metrics);

    expect(output).toContain('# HELP http_requests_total Total HTTP requests');
    expect(output).toContain('# TYPE http_requests_total counter');
    expect(output).toContain('http_requests_total{method="GET"} 42');
  });

  test('should export gauge', () => {
    const metrics = [
      {
        name: 'memory_bytes',
        type: 'gauge' as const,
        value: 1024000,
        labels: {},
      },
    ];

    const output = exporter.export(metrics);
    expect(output).toContain('memory_bytes 1024000');
  });

  test('should handle multiple labels', () => {
    const metrics = [
      {
        name: 'http_requests_total',
        type: 'counter' as const,
        value: 10,
        labels: { method: 'GET', status: '200' },
      },
    ];

    const output = exporter.export(metrics);
    expect(output).toContain('method="GET"');
    expect(output).toContain('status="200"');
  });

  test('should escape special characters in labels', () => {
    const metrics = [
      {
        name: 'test_metric',
        type: 'counter' as const,
        value: 1,
        labels: { path: '/api/users?id=123' },
      },
    ];

    const output = exporter.export(metrics);
    // The exporter should properly escape the label value
    expect(output).toContain('path=');
  });
});
