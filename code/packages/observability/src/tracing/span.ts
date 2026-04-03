import { Span, SpanEvent, SpanStatus } from './types';

/**
 * Span utilities for managing span lifecycle and data
 */
export class SpanUtils {
  /**
   * Mark a span as ended
   */
  static end(span: Span): void {
    if (!span.endTime) {
      span.endTime = Date.now();
    }
  }

  /**
   * Check if a span has ended
   */
  static isEnded(span: Span): boolean {
    return span.endTime !== undefined;
  }

  /**
   * Get the duration of a span in milliseconds
   */
  static getDuration(span: Span): number | undefined {
    if (!span.endTime) {
      return undefined;
    }
    return span.endTime - span.startTime;
  }

  /**
   * Set the status of a span
   */
  static setStatus(span: Span, status: SpanStatus): void {
    span.status = status;
  }

  /**
   * Add an event to a span
   */
  static addEvent(
    span: Span,
    name: string,
    attributes?: Record<string, any>
  ): SpanEvent {
    const event: SpanEvent = {
      name,
      timestamp: Date.now(),
      attributes: attributes || {},
    };
    span.events.push(event);
    return event;
  }

  /**
   * Set an attribute on a span
   */
  static setAttribute(span: Span, key: string, value: any): void {
    span.attributes[key] = value;
  }

  /**
   * Set multiple attributes on a span
   */
  static setAttributes(span: Span, attributes: Record<string, any>): void {
    Object.assign(span.attributes, attributes);
  }

  /**
   * Record an exception on a span
   */
  static recordException(span: Span, error: Error): void {
    span.status = {
      code: 'ERROR',
      message: error.message,
    };

    SpanUtils.addEvent(span, 'exception', {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack || '',
    });
  }

  /**
   * Check if a span has an error status
   */
  static hasError(span: Span): boolean {
    return span.status.code === 'ERROR';
  }
}
