/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  /** Dashboard title */
  title?: string;
  /** Datasource UID */
  datasource?: string;
  /** Dashboard tags */
  tags?: string[];
  /** Dashboard timezone */
  timezone?: 'browser' | 'utc';
  /** Refresh interval */
  refresh?: string;
  /** Time range */
  time?: {
    from: string;
    to: string;
  };
}

/**
 * Panel configuration
 */
export interface PanelConfig {
  title: string;
  type: string;
  targets: Array<{
    expr: string;
    legendFormat?: string;
    refId?: string;
  }>;
  gridPos?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  options?: any;
}

/**
 * GrafanaDashboardGenerator creates Grafana dashboard JSON
 */
export class GrafanaDashboardGenerator {
  /**
   * Generate a complete Grafana dashboard JSON
   */
  generate(config: DashboardConfig = {}): any {
    const panels = this.createDefaultPanels();

    return {
      dashboard: {
        title: config.title || 'OpenAgent Dashboard',
        tags: config.tags || ['openagent', 'observability'],
        timezone: config.timezone || 'browser',
        refresh: config.refresh || '10s',
        time: config.time || {
          from: 'now-1h',
          to: 'now',
        },
        panels: this.layoutPanels(panels),
      },
      overwrite: true,
    };
  }

  /**
   * Create default monitoring panels
   */
  private createDefaultPanels(): PanelConfig[] {
    return [
      this.createRequestRatePanel(),
      this.createResponseTimePanel(),
      this.createErrorRatePanel(),
      this.createActiveSessionsPanel(),
      this.createLLMCallsPanel(),
      this.createTokenUsagePanel(),
      this.createMemoryUsagePanel(),
      this.createCPUUsagePanel(),
    ];
  }

  /**
   * Layout panels in a grid
   */
  private layoutPanels(panels: PanelConfig[]): any[] {
    const layoutedPanels: any[] = [];
    const panelWidth = 12; // Full width
    const panelHeight = 8;
    let currentY = 0;

    for (const panel of panels) {
      layoutedPanels.push({
        ...panel,
        gridPos: {
          x: 0,
          y: currentY,
          w: panelWidth,
          h: panelHeight,
        },
      });
      currentY += panelHeight;
    }

    return layoutedPanels;
  }

  /**
   * Create request rate panel
   */
  private createRequestRatePanel(): PanelConfig {
    return {
      title: 'Request Rate',
      type: 'timeseries',
      targets: [
        {
          expr: 'rate(http_requests_total[5m])',
          legendFormat: '{{method}} {{path}}',
          refId: 'A',
        },
      ],
      options: {
        legend: {
          displayMode: 'list',
          placement: 'bottom',
        },
      },
    };
  }

  /**
   * Create response time panel
   */
  private createResponseTimePanel(): PanelConfig {
    return {
      title: 'Response Time (P95)',
      type: 'timeseries',
      targets: [
        {
          expr: 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))',
          legendFormat: 'P95 Response Time',
          refId: 'A',
        },
        {
          expr: 'histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))',
          legendFormat: 'P99 Response Time',
          refId: 'B',
        },
      ],
      options: {
        legend: {
          displayMode: 'list',
          placement: 'bottom',
        },
      },
    };
  }

  /**
   * Create error rate panel
   */
  private createErrorRatePanel(): PanelConfig {
    return {
      title: 'Error Rate',
      type: 'timeseries',
      targets: [
        {
          expr: 'rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100',
          legendFormat: 'Error Rate %',
          refId: 'A',
        },
      ],
      options: {
        legend: {
          displayMode: 'list',
          placement: 'bottom',
        },
        thresholds: {
          mode: 'absolute',
          steps: [
            { color: 'green', value: null },
            { color: 'yellow', value: 1 },
            { color: 'red', value: 5 },
          ],
        },
      },
    };
  }

  /**
   * Create active sessions panel
   */
  private createActiveSessionsPanel(): PanelConfig {
    return {
      title: 'Active Sessions',
      type: 'stat',
      targets: [
        {
          expr: 'openagent_sessions_active',
          legendFormat: 'Active Sessions',
          refId: 'A',
        },
      ],
      options: {
        colorMode: 'value',
        graphMode: 'area',
      },
    };
  }

  /**
   * Create LLM API calls panel
   */
  private createLLMCallsPanel(): PanelConfig {
    return {
      title: 'LLM API Calls',
      type: 'timeseries',
      targets: [
        {
          expr: 'rate(openagent_llm_calls_total[5m])',
          legendFormat: '{{provider}} - {{model}}',
          refId: 'A',
        },
      ],
      options: {
        legend: {
          displayMode: 'table',
          placement: 'right',
          calcs: ['lastNotNull', 'mean', 'max'],
        },
      },
    };
  }

  /**
   * Create token usage panel
   */
  private createTokenUsagePanel(): PanelConfig {
    return {
      title: 'Token Usage',
      type: 'timeseries',
      targets: [
        {
          expr: 'rate(openagent_tokens_total{type="input"}[5m])',
          legendFormat: 'Input Tokens',
          refId: 'A',
        },
        {
          expr: 'rate(openagent_tokens_total{type="output"}[5m])',
          legendFormat: 'Output Tokens',
          refId: 'B',
        },
      ],
      options: {
        legend: {
          displayMode: 'list',
          placement: 'bottom',
        },
        stacking: {
          mode: 'normal',
        },
      },
    };
  }

  /**
   * Create memory usage panel
   */
  private createMemoryUsagePanel(): PanelConfig {
    return {
      title: 'Memory Usage',
      type: 'timeseries',
      targets: [
        {
          expr: 'process_resident_memory_bytes / 1024 / 1024',
          legendFormat: 'Memory (MB)',
          refId: 'A',
        },
      ],
      options: {
        legend: {
          displayMode: 'list',
          placement: 'bottom',
        },
      },
    };
  }

  /**
   * Create CPU usage panel
   */
  private createCPUUsagePanel(): PanelConfig {
    return {
      title: 'CPU Usage',
      type: 'timeseries',
      targets: [
        {
          expr: 'rate(process_cpu_seconds_total[5m]) * 100',
          legendFormat: 'CPU %',
          refId: 'A',
        },
      ],
      options: {
        legend: {
          displayMode: 'list',
          placement: 'bottom',
        },
      },
    };
  }

  /**
   * Generate a custom dashboard from panel configs
   */
  generateCustom(
    config: DashboardConfig,
    panels: PanelConfig[]
  ): any {
    return {
      dashboard: {
        title: config.title || 'Custom Dashboard',
        tags: config.tags || [],
        timezone: config.timezone || 'browser',
        refresh: config.refresh || '10s',
        time: config.time || {
          from: 'now-1h',
          to: 'now',
        },
        panels: this.layoutPanels(panels),
      },
      overwrite: true,
    };
  }
}
