import { Span, SpanExporter, JaegerConfig } from '../types';

/**
 * JaegerSpanExporter exports spans to Jaeger
 * Supports Jaeger's native format over HTTP
 */
export class JaegerExporter implements SpanExporter {
  private endpoint: string;
  private serviceName: string;

  constructor(config?: JaegerConfig) {
    this.endpoint = config?.endpoint || 'http://localhost:14268/api/traces';
    this.serviceName = config?.serviceName || 'openagent-service';
  }

  /**
   * Export spans to Jaeger
   */
  async export(spans: Span[]): Promise<void> {
    if (spans.length === 0) return;

    const trace = this.convertToJaegerFormat(spans);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trace),
      });

      if (!response.ok) {
        console.error(`Jaeger export failed: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error(`Failed to export spans to Jaeger: ${error.message}`);
    }
  }

  /**
   * Convert spans to Jaeger format
   */
  private convertToJaegerFormat(spans: Span[]): any {
    const processes: any = {};
    const processId = 'p1';

    processes[processId] = {
      serviceName: this.serviceName,
      tags: [],
    };

    return {
      data: [
        {
          traceID: spans[0]?.traceId || '',
          spans: spans.map((span) => this.convertSpan(span, processId)),
          processes,
        },
      ],
    };
  }

  /**
   * Convert a single span to Jaeger format
   */
  private convertSpan(span: Span, processId: string): any {
    return {
      traceID: span.traceId,
      spanID: span.id,
      parentSpanID: span.parentSpanId || undefined,
      operationName: span.name,
      startTime: span.startTime * 1000, // Convert to microseconds
      duration: span.endTime ? (span.endTime - span.startTime) * 1000 : 0,
      tags: this.attributesToTags(span.attributes),
      logs: span.events.map((event) => ({
        timestamp: event.timestamp * 1000,
        fields: this.attributesToTags(event.attributes),
      })),
      processID: processId,
      warnings: null,
    };
  }

  /**
   * Convert attributes to Jaeger tags
   */
  private attributesToTags(attributes: Record<string, any>): any[] {
    return Object.entries(attributes).map(([key, value]) => ({
      key,
      value: this.serializeValue(value),
      type: this.getValueType(value),
    }));
  }

  /**
   * Serialize a value for Jaeger
   */
  private serializeValue(value: any): any {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  }

  /**
   * Get the Jaeger type for a value
   */
  private getValueType(value: any): string {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'int64' : 'float64';
    }
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'string') return 'string';
    return 'string';
  }
}
