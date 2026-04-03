import { IGauge, MetricConfig } from './types';

/**
 * Gauge is a metric that can increase and decrease
 * Use for temperatures, current memory usage, number of concurrent requests, etc.
 */
export class Gauge implements IGauge {
  name: string;
  type = 'gauge' as const;
  description?: string;
  value = 0;
  labels: Record<string, string>;

  private labeledValues: Map<string, number> = new Map();

  constructor(
    name: string,
    config: MetricConfig,
    defaultLabels: Record<string, string>
  ) {
    this.name = name;
    this.description = config.description;
    this.labels = { ...defaultLabels };
  }

  /**
   * Set the gauge to a specific value
   */
  set(value: number): void {
    this.value = value;
  }

  /**
   * Increment the gauge
   */
  inc(value = 1): void {
    this.value += value;
  }

  /**
   * Decrement the gauge
   */
  dec(value = 1): void {
    this.value -= value;
  }

  /**
   * Set the gauge to the current Unix timestamp in seconds
   */
  setToCurrentTime(): void {
    this.value = Math.floor(Date.now() / 1000);
  }

  /**
   * Set value for specific labels
   */
  setWithLabels(labels: Record<string, string>, value: number): void {
    const labelKey = this.serializeLabels(labels);
    this.labeledValues.set(labelKey, value);
  }

  /**
   * Increment with specific labels
   */
  incWithLabels(labels: Record<string, string>, value = 1): void {
    const labelKey = this.serializeLabels(labels);
    const currentValue = this.labeledValues.get(labelKey) || 0;
    this.labeledValues.set(labelKey, currentValue + value);
  }

  /**
   * Decrement with specific labels
   */
  decWithLabels(labels: Record<string, string>, value = 1): void {
    const labelKey = this.serializeLabels(labels);
    const currentValue = this.labeledValues.get(labelKey) || 0;
    this.labeledValues.set(labelKey, currentValue - value);
  }

  /**
   * Get value for specific labels
   */
  getValueForLabels(labels: Record<string, string>): number {
    const labelKey = this.serializeLabels(labels);
    return this.labeledValues.get(labelKey) || 0;
  }

  /**
   * Reset the gauge (primarily for testing)
   */
  reset(): void {
    this.value = 0;
    this.labeledValues.clear();
  }

  /**
   * Serialize labels to a string key
   */
  private serializeLabels(labels: Record<string, string>): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }
}
