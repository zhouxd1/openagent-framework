import { ICounter, MetricConfig } from './types';

/**
 * Counter is a cumulative metric that only increases
 * Use for counting requests, tasks completed, errors, etc.
 */
export class Counter implements ICounter {
  name: string;
  type = 'counter' as const;
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
   * Increment the counter
   */
  inc(value = 1): void {
    if (value < 0) {
      throw new Error('Counter can only be incremented by non-negative values');
    }
    this.value += value;
  }

  /**
   * Increment with specific labels
   */
  incWithLabels(labels: Record<string, string>, value = 1): void {
    if (value < 0) {
      throw new Error('Counter can only be incremented by non-negative values');
    }

    const labelKey = this.serializeLabels(labels);
    const currentValue = this.labeledValues.get(labelKey) || 0;
    this.labeledValues.set(labelKey, currentValue + value);

    // Also update the main value
    this.value += value;
  }

  /**
   * Reset the counter (primarily for testing)
   */
  reset(): void {
    this.value = 0;
    this.labeledValues.clear();
  }

  /**
   * Get value for specific labels
   */
  getValueForLabels(labels: Record<string, string>): number {
    const labelKey = this.serializeLabels(labels);
    return this.labeledValues.get(labelKey) || 0;
  }

  /**
   * Get all labeled values
   */
  getLabeledValues(): Map<string, number> {
    return new Map(this.labeledValues);
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
