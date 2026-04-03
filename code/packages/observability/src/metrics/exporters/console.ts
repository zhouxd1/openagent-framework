import { Metric, MetricExporter } from '../types';

/**
 * ConsoleMetricExporter exports metrics to console for debugging
 */
export class ConsoleMetricExporter implements MetricExporter {
  /**
   * Export metrics in a human-readable format
   */
  export(metrics: Metric[]): string {
    const lines: string[] = [];

    lines.push('=== Metrics ===\n');

    for (const metric of metrics) {
      lines.push(`${metric.type.toUpperCase()}: ${metric.name}`);
      if (metric.description) {
        lines.push(`  Description: ${metric.description}`);
      }

      const labelStr = this.formatLabels(metric.labels);
      if (labelStr) {
        lines.push(`  Labels: ${labelStr}`);
      }

      if (metric.type === 'histogram') {
        const buckets = metric.value as number[];
        lines.push(`  Buckets: ${buckets.length} buckets`);
        lines.push(`  Values: [${buckets.join(', ')}]`);
      } else {
        const value = Array.isArray(metric.value) ? metric.value[0] : metric.value;
        lines.push(`  Value: ${value}`);
      }

      lines.push(''); // Blank line between metrics
    }

    lines.push('===============\n');

    return lines.join('\n');
  }

  /**
   * Format labels for display
   */
  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';

    return entries.map(([key, value]) => `${key}="${value}"`).join(', ');
  }
}
