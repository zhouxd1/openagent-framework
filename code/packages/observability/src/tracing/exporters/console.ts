import { Span, SpanExporter } from '../types';

/**
 * ConsoleSpanExporter exports spans to the console
 * Useful for development and debugging
 */
export class ConsoleSpanExporter implements SpanExporter {
  private prettyPrint: boolean;

  constructor(options?: { prettyPrint?: boolean }) {
    this.prettyPrint = options?.prettyPrint ?? true;
  }

  /**
   * Export spans to console
   */
  async export(spans: Span[]): Promise<void> {
    for (const span of spans) {
      if (this.prettyPrint) {
        this.prettyPrintSpan(span);
      } else {
        console.log(JSON.stringify(span));
      }
    }
  }

  /**
   * Pretty print a span
   */
  private prettyPrintSpan(span: Span): void {
    const duration = span.endTime ? span.endTime - span.startTime : 'N/A';
    const status = span.status.code;

    console.log('\n=== Span ===');
    console.log(`Name: ${span.name}`);
    console.log(`Trace ID: ${span.traceId}`);
    console.log(`Span ID: ${span.id}`);
    if (span.parentSpanId) {
      console.log(`Parent Span ID: ${span.parentSpanId}`);
    }
    console.log(`Duration: ${duration}ms`);
    console.log(`Status: ${status}${span.status.message ? ` - ${span.status.message}` : ''}`);

    if (Object.keys(span.attributes).length > 0) {
      console.log('Attributes:');
      for (const [key, value] of Object.entries(span.attributes)) {
        console.log(`  ${key}: ${value}`);
      }
    }

    if (span.events.length > 0) {
      console.log('Events:');
      for (const event of span.events) {
        console.log(`  [${new Date(event.timestamp).toISOString()}] ${event.name}`);
        if (Object.keys(event.attributes).length > 0) {
          for (const [key, value] of Object.entries(event.attributes)) {
            console.log(`    ${key}: ${value}`);
          }
        }
      }
    }

    console.log('============\n');
  }
}
