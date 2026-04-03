/**
 * Metric types
 */
export type MetricType = 'counter' | 'gauge' | 'histogram';

/**
 * Base metric interface
 */
export interface Metric {
  /** Metric name */
  name: string;
  /** Metric type */
  type: MetricType;
  /** Description of the metric */
  description?: string;
  /** Current value */
  value: number | number[];
  /** Labels attached to the metric */
  labels: Record<string, string>;
}

/**
 * Base metric configuration
 */
export interface MetricConfig {
  /** Description of what the metric measures */
  description?: string;
  /** Label names for this metric */
  labels?: string[];
}

/**
 * Histogram-specific configuration
 */
export interface HistogramConfig extends MetricConfig {
  /** Bucket boundaries for the histogram */
  buckets?: number[];
}

/**
 * Metric exporter interface
 */
export interface MetricExporter {
  /**
   * Export metrics in a specific format
   */
  export(metrics: Metric[]): string;
}

/**
 * Counter interface
 */
export interface ICounter extends Metric {
  /**
   * Increment the counter
   */
  inc(value?: number): void;

  /**
   * Increment with specific labels
   */
  incWithLabels(labels: Record<string, string>, value?: number): void;
}

/**
 * Gauge interface
 */
export interface IGauge extends Metric {
  /**
   * Set the gauge value
   */
  set(value: number): void;

  /**
   * Increment the gauge
   */
  inc(value?: number): void;

  /**
   * Decrement the gauge
   */
  dec(value?: number): void;

  /**
   * Set to current time in seconds
   */
  setToCurrentTime(): void;
}

/**
 * Histogram interface
 */
export interface IHistogram extends Metric {
  /**
   * Observe a value
   */
  observe(value: number): void;

  /**
   * Observe with specific labels
   */
  observeWithLabels(labels: Record<string, string>, value: number): void;

  /**
   * Get bucket boundaries
   */
  getBuckets(): number[];

  /**
   * Get bucket counts
   */
  getBucketCounts(): number[];

  /**
   * Get sum of all observed values
   */
  getSum(): number;

  /**
   * Get count of observations
   */
  getCount(): number;

  /**
   * Get labeled bucket data
   */
  getLabeledData(labels: Record<string, string>): { counts: number[]; sum: number; count: number } | undefined;

  /**
   * Calculate percentile
   */
  getPercentile(p: number): number | undefined;

  /**
   * Reset the histogram
   */
  reset(): void;
}

/**
 * Metrics configuration
 */
export interface MetricsConfig {
  /** Enable metrics collection */
  enabled?: boolean;
  /** Exporter type */
  exporter?: 'console' | 'prometheus';
  /** Port for Prometheus metrics endpoint */
  prometheusPort?: number;
  /** Default labels for all metrics */
  defaultLabels?: Record<string, string>;
}
