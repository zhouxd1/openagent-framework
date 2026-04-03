import { Metric, MetricExporter } from '../types';

/**
 * PrometheusExporter exports metrics in Prometheus text format
 * @see https://prometheus.io/docs/instrumenting/exposition_formats/
 */
export class PrometheusExporter implements MetricExporter {
  /**
   * Export metrics in Prometheus format
   */
  export(metrics: Metric[]): string {
    const lines: string[] = [];

    for (const metric of metrics) {
      // Add HELP comment if description exists
      if (metric.description) {
        lines.push(`# HELP ${metric.name} ${metric.description}`);
      }

      // Add TYPE comment
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      // Add metric value(s)
      if (metric.type === 'histogram') {
        this.addHistogramLines(lines, metric);
      } else {
        this.addSimpleMetricLines(lines, metric);
      }

      lines.push(''); // Add blank line between metrics
    }

    return lines.join('\n').trim();
  }

  /**
   * Add lines for histogram metrics
   */
  private addHistogramLines(lines: string[], metric: Metric): void {
    const buckets = metric.value as number[];
    const bucketBoundaries = this.getBucketBoundaries(metric);

    // Add bucket lines
    for (let i = 0; i < buckets.length; i++) {
      const le = i < bucketBoundaries.length ? bucketBoundaries[i] : '+Inf';
      const labelStr = this.formatLabels({
        ...metric.labels,
        le: le.toString(),
      });
      lines.push(`${metric.name}_bucket${labelStr} ${buckets[i]}`);
    }

    // Add sum and count
    const labelStr = this.formatLabels(metric.labels);
    // Note: In a real implementation, we'd track sum and count separately
    // For now, we'll just add placeholder lines
    lines.push(`${metric.name}_sum${labelStr} 0`);
    lines.push(`${metric.name}_count${labelStr} ${buckets[buckets.length - 1] || 0}`);
  }

  /**
   * Add lines for counter and gauge metrics
   */
  private addSimpleMetricLines(lines: string[], metric: Metric): void {
    const labelStr = this.formatLabels(metric.labels);
    const value = Array.isArray(metric.value) ? metric.value[0] : metric.value;
    lines.push(`${metric.name}${labelStr} ${value}`);
  }

  /**
   * Format labels into Prometheus label format
   */
  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';

    const labelStr = entries
      .map(([key, value]) => `${key}="${this.escapeLabelValue(value)}"`)
      .join(', ');

    return `{${labelStr}}`;
  }

  /**
   * Escape special characters in label values
   */
  private escapeLabelValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }

  /**
   * Get bucket boundaries for a histogram
   * This is a placeholder - in a real implementation, we'd store these
   */
  private getBucketBoundaries(metric: Metric): number[] {
    // Default Prometheus buckets
    return [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  }
}
