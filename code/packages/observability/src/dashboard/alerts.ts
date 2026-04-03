/**
 * Alert rule configuration
 */
export interface AlertRule {
  /** Alert name */
  name: string;
  /** PromQL expression */
  expr: string;
  /** Duration before alert fires */
  for?: string;
  /** Alert labels */
  labels?: Record<string, string>;
  /** Alert annotations */
  annotations?: Record<string, string>;
  /** Alert severity */
  severity?: 'info' | 'warning' | 'critical';
}

/**
 * Alert group configuration
 */
export interface AlertGroup {
  /** Group name */
  name: string;
  /** Rules in this group */
  rules: AlertRule[];
  /** Evaluation interval */
  interval?: string;
}

/**
 * AlertRulesGenerator creates Prometheus alerting rules
 */
export class AlertRulesGenerator {
  private groups: AlertGroup[] = [];

  /**
   * Add an alert group
   */
  addGroup(group: AlertGroup): this {
    this.groups.push(group);
    return this;
  }

  /**
   * Generate default OpenAgent alert rules
   */
  generateDefault(): AlertGroup[] {
    return [
      this.createOpenAgentAlerts(),
      this.createPerformanceAlerts(),
      this.createLLMAlerts(),
      this.createSystemAlerts(),
    ];
  }

  /**
   * Generate Prometheus alerting rules YAML
   */
  generateYAML(): string {
    const groups = this.groups.length > 0 ? this.groups : this.generateDefault();

    const lines: string[] = ['groups:'];

    for (const group of groups) {
      lines.push(`  - name: ${group.name}`);
      if (group.interval) {
        lines.push(`    interval: ${group.interval}`);
      }
      lines.push('    rules:');

      for (const rule of group.rules) {
        lines.push(`      - alert: ${rule.name}`);
        lines.push(`        expr: ${rule.expr}`);
        if (rule.for) {
          lines.push(`        for: ${rule.for}`);
        }
        if (rule.labels) {
          lines.push('        labels:');
          for (const [key, value] of Object.entries(rule.labels)) {
            lines.push(`          ${key}: ${value}`);
          }
        }
        if (rule.annotations) {
          lines.push('        annotations:');
          for (const [key, value] of Object.entries(rule.annotations)) {
            lines.push(`          ${key}: ${value}`);
          }
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Create OpenAgent-specific alerts
   */
  private createOpenAgentAlerts(): AlertGroup {
    return {
      name: 'openagent_alerts',
      interval: '30s',
      rules: [
        {
          name: 'OpenAgentHighErrorRate',
          expr: 'rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05',
          for: '5m',
          severity: 'critical',
          labels: {
            severity: 'critical',
            service: 'openagent',
          },
          annotations: {
            summary: 'High error rate detected',
            description: 'Error rate is {{ $value | humanizePercentage }} for more than 5 minutes',
          },
        },
        {
          name: 'OpenAgentSessionLimit',
          expr: 'openagent_sessions_active / openagent_sessions_limit > 0.9',
          for: '5m',
          severity: 'warning',
          labels: {
            severity: 'warning',
            service: 'openagent',
          },
          annotations: {
            summary: 'Approaching session limit',
            description: 'Session usage is at {{ $value | humanizePercentage }} of limit',
          },
        },
      ],
    };
  }

  /**
   * Create performance alerts
   */
  private createPerformanceAlerts(): AlertGroup {
    return {
      name: 'performance_alerts',
      interval: '30s',
      rules: [
        {
          name: 'HighResponseTime',
          expr: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2',
          for: '5m',
          severity: 'warning',
          labels: {
            severity: 'warning',
            category: 'performance',
          },
          annotations: {
            summary: 'High response time detected',
            description: 'P95 response time is {{ $value }}s',
          },
        },
        {
          name: 'VeryHighResponseTime',
          expr: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 5',
          for: '2m',
          severity: 'critical',
          labels: {
            severity: 'critical',
            category: 'performance',
          },
          annotations: {
            summary: 'Very high response time detected',
            description: 'P95 response time is {{ $value }}s',
          },
        },
      ],
    };
  }

  /**
   * Create LLM-specific alerts
   */
  private createLLMAlerts(): AlertGroup {
    return {
      name: 'llm_alerts',
      interval: '30s',
      rules: [
        {
          name: 'LLMHighLatency',
          expr: 'histogram_quantile(0.95, rate(openagent_llm_request_duration_seconds_bucket[5m])) > 30',
          for: '5m',
          severity: 'warning',
          labels: {
            severity: 'warning',
            category: 'llm',
          },
          annotations: {
            summary: 'High LLM API latency',
            description: 'P95 LLM request duration is {{ $value }}s',
          },
        },
        {
          name: 'LLMErrorRate',
          expr: 'rate(openagent_llm_errors_total[5m]) / rate(openagent_llm_calls_total[5m]) > 0.1',
          for: '5m',
          severity: 'critical',
          labels: {
            severity: 'critical',
            category: 'llm',
          },
          annotations: {
            summary: 'High LLM error rate',
            description: 'LLM error rate is {{ $value | humanizePercentage }}',
          },
        },
        {
          name: 'TokenBudgetExceeded',
          expr: 'rate(openagent_tokens_total[1h]) > 1000000',
          for: '1m',
          severity: 'warning',
          labels: {
            severity: 'warning',
            category: 'llm',
          },
          annotations: {
            summary: 'Token usage spike detected',
            description: 'Token usage rate is {{ $value }} tokens/hour',
          },
        },
      ],
    };
  }

  /**
   * Create system resource alerts
   */
  private createSystemAlerts(): AlertGroup {
    return {
      name: 'system_alerts',
      interval: '30s',
      rules: [
        {
          name: 'HighMemoryUsage',
          expr: 'process_resident_memory_bytes / process_memory_limit_bytes > 0.9',
          for: '5m',
          severity: 'warning',
          labels: {
            severity: 'warning',
            category: 'system',
          },
          annotations: {
            summary: 'High memory usage',
            description: 'Memory usage is {{ $value | humanizePercentage }}',
          },
        },
        {
          name: 'HighCPUUsage',
          expr: 'rate(process_cpu_seconds_total[5m]) > 0.9',
          for: '5m',
          severity: 'warning',
          labels: {
            severity: 'warning',
            category: 'system',
          },
          annotations: {
            summary: 'High CPU usage',
            description: 'CPU usage is {{ $value }} cores',
          },
        },
      ],
    };
  }

  /**
   * Generate alerts as JSON (for programmatic use)
   */
  generateJSON(): AlertGroup[] {
    return this.groups.length > 0 ? this.groups : this.generateDefault();
  }

  /**
   * Create a custom alert rule
   */
  createCustomAlert(config: {
    name: string;
    expr: string;
    for?: string;
    severity?: 'info' | 'warning' | 'critical';
    summary: string;
    description: string;
  }): AlertRule {
    return {
      name: config.name,
      expr: config.expr,
      for: config.for || '5m',
      severity: config.severity || 'warning',
      labels: {
        severity: config.severity || 'warning',
      },
      annotations: {
        summary: config.summary,
        description: config.description,
      },
    };
  }
}
