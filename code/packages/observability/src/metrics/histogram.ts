import { IHistogram, HistogramConfig } from './types';

/**
 * Histogram observes and counts observations in buckets
 * Use for request durations, response sizes, etc.
 */
export class Histogram implements IHistogram {
  name: string;
  type = 'histogram' as const;
  description?: string;
  value: number[];
  labels: Record<string, string>;

  private buckets: number[];
  private bucketCounts: number[];
  private sum = 0;
  private count = 0;
  private labeledBuckets: Map<string, { counts: number[]; sum: number; count: number }> = new Map();

  constructor(
    name: string,
    config: HistogramConfig,
    defaultLabels: Record<string, string>
  ) {
    this.name = name;
    this.description = config.description;
    this.labels = { ...defaultLabels };

    // Default Prometheus buckets
    this.buckets = config.buckets || [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
    this.bucketCounts = new Array(this.buckets.length + 1).fill(0); // +1 for +Inf bucket
    this.value = this.bucketCounts;
  }

  /**
   * Observe a value
   * In Prometheus histograms, buckets are cumulative
   */
  observe(value: number): void {
    this.sum += value;
    this.count++;

    // In cumulative histograms, we increment all buckets where value <= bucket
    // Plus the +Inf bucket always gets incremented
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        this.bucketCounts[i]++;
      }
    }
    // Always increment the +Inf bucket
    this.bucketCounts[this.buckets.length]++;
  }

  /**
   * Observe with specific labels
   */
  observeWithLabels(labels: Record<string, string>, value: number): void {
    const labelKey = this.serializeLabels(labels);
    let labeledData = this.labeledBuckets.get(labelKey);

    if (!labeledData) {
      labeledData = {
        counts: new Array(this.buckets.length + 1).fill(0),
        sum: 0,
        count: 0,
      };
      this.labeledBuckets.set(labelKey, labeledData);
    }

    labeledData.sum += value;
    labeledData.count++;

    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        labeledData.counts[i]++;
      }
    }
    labeledData.counts[this.buckets.length]++;

    // Also update main histogram
    this.observe(value);
  }

  /**
   * Get bucket boundaries
   */
  getBuckets(): number[] {
    return [...this.buckets];
  }

  /**
   * Get bucket counts
   */
  getBucketCounts(): number[] {
    return [...this.bucketCounts];
  }

  /**
   * Get sum of all observed values
   */
  getSum(): number {
    return this.sum;
  }

  /**
   * Get count of observations
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Get labeled bucket data
   */
  getLabeledData(labels: Record<string, string>): { counts: number[]; sum: number; count: number } | undefined {
    return this.labeledBuckets.get(this.serializeLabels(labels));
  }

  /**
   * Calculate percentile
   */
  getPercentile(p: number): number | undefined {
    if (this.count === 0) return undefined;

    const targetCount = (p / 100) * this.count;
    let cumulativeCount = 0;

    for (let i = 0; i < this.buckets.length; i++) {
      cumulativeCount += this.bucketCounts[i];
      if (cumulativeCount >= targetCount) {
        return this.buckets[i];
      }
    }

    // If we've exceeded all buckets, return the largest bucket
    return this.buckets[this.buckets.length - 1];
  }

  /**
   * Reset the histogram (primarily for testing)
   */
  reset(): void {
    this.bucketCounts = new Array(this.buckets.length + 1).fill(0);
    this.value = this.bucketCounts;
    this.sum = 0;
    this.count = 0;
    this.labeledBuckets.clear();
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
