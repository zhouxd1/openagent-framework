import { Metric, MetricConfig, HistogramConfig, MetricsConfig } from './types';
import { Counter } from './counter';
import { Gauge } from './gauge';
import { Histogram } from './histogram';
import { PrometheusExporter } from './exporters/prometheus';
import { ConsoleMetricExporter } from './exporters/console';

/**
 * MetricRegistry is the central point for creating and managing metrics
 */
export class MetricRegistry {
  private metrics: Map<string, Metric>;
  private labels: Record<string, string>;
  private config: MetricsConfig;

  constructor(config?: MetricsConfig) {
    this.metrics = new Map();
    this.labels = config?.defaultLabels || {};
    this.config = config || {};
  }

  /**
   * Create a counter metric
   */
  createCounter(name: string, config?: MetricConfig): Counter {
    if (this.metrics.has(name)) {
      throw new Error(`Metric ${name} already exists`);
    }

    const counter = new Counter(name, config || {}, this.labels);
    this.metrics.set(name, counter);
    return counter;
  }

  /**
   * Create or get a counter metric
   */
  getOrCreateCounter(name: string, config?: MetricConfig): Counter {
    const existing = this.metrics.get(name);
    if (existing && existing.type === 'counter') {
      return existing as Counter;
    }
    return this.createCounter(name, config);
  }

  /**
   * Create a gauge metric
   */
  createGauge(name: string, config?: MetricConfig): Gauge {
    if (this.metrics.has(name)) {
      throw new Error(`Metric ${name} already exists`);
    }

    const gauge = new Gauge(name, config || {}, this.labels);
    this.metrics.set(name, gauge);
    return gauge;
  }

  /**
   * Create or get a gauge metric
   */
  getOrCreateGauge(name: string, config?: MetricConfig): Gauge {
    const existing = this.metrics.get(name);
    if (existing && existing.type === 'gauge') {
      return existing as Gauge;
    }
    return this.createGauge(name, config);
  }

  /**
   * Create a histogram metric
   */
  createHistogram(name: string, config?: HistogramConfig): Histogram {
    if (this.metrics.has(name)) {
      throw new Error(`Metric ${name} already exists`);
    }

    const histogram = new Histogram(name, config || {}, this.labels);
    this.metrics.set(name, histogram);
    return histogram;
  }

  /**
   * Create or get a histogram metric
   */
  getOrCreateHistogram(name: string, config?: HistogramConfig): Histogram {
    const existing = this.metrics.get(name);
    if (existing && existing.type === 'histogram') {
      return existing as Histogram;
    }
    return this.createHistogram(name, config);
  }

  /**
   * Get a metric by name
   */
  getMetric(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  /**
   * Set default labels for all metrics
   */
  setLabels(labels: Record<string, string>): void {
    Object.assign(this.labels, labels);
  }

  /**
   * Get all metrics
   */
  getMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Export metrics in the specified format
   */
  async export(format: 'prometheus' | 'json'): Promise<string> {
    const metrics = this.getMetrics();

    if (format === 'prometheus') {
      const exporter = new PrometheusExporter();
      return exporter.export(metrics);
    } else {
      return JSON.stringify(metrics, null, 2);
    }
  }

  /**
   * Export to Prometheus format
   */
  exportPrometheus(): string {
    const exporter = new PrometheusExporter();
    return exporter.export(this.getMetrics());
  }

  /**
   * Export to console (formatted for debugging)
   */
  exportConsole(): string {
    const exporter = new ConsoleMetricExporter();
    return exporter.export(this.getMetrics());
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Remove a specific metric
   */
  remove(name: string): boolean {
    return this.metrics.delete(name);
  }

  /**
   * Get metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Get the number of registered metrics
   */
  get size(): number {
    return this.metrics.size;
  }
}
