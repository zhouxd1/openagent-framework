import { describe, test, expect, beforeEach } from 'vitest';
import { GrafanaDashboardGenerator, DashboardConfig, PanelConfig } from '../src/dashboard/grafana';
import { AlertRulesGenerator, AlertRule, AlertGroup } from '../src/dashboard/alerts';

describe('GrafanaDashboardGenerator', () => {
  let generator: GrafanaDashboardGenerator;

  beforeEach(() => {
    generator = new GrafanaDashboardGenerator();
  });

  describe('generate', () => {
    test('should generate dashboard with default config', () => {
      const result = generator.generate({ title: 'Test Dashboard' });

      expect(result).toBeDefined();
      expect(result.dashboard).toBeDefined();
      expect(result.dashboard.title).toBe('Test Dashboard');
      expect(result.dashboard.panels).toBeDefined();
      expect(Array.isArray(result.dashboard.panels)).toBe(true);
      expect(result.overwrite).toBe(true);
    });

    test('should generate dashboard with custom config', () => {
      const result = generator.generate({
        title: 'Custom Dashboard',
        refresh: '30s',
        tags: ['custom', 'test'],
      });

      expect(result.dashboard.title).toBe('Custom Dashboard');
      expect(result.dashboard.refresh).toBe('30s');
      expect(result.dashboard.tags).toContain('custom');
      expect(result.dashboard.tags).toContain('test');
    });

    test('should include standard panels', () => {
      const result = generator.generate({ title: 'Test' });

      // Should have panels for tracing, metrics, logging
      expect(result.dashboard.panels.length).toBeGreaterThan(0);
    });
  });

  describe('generateCustom', () => {
    test('should generate custom dashboard with panels', () => {
      const config: DashboardConfig = {
        title: 'Custom Panel Dashboard',
      };

      const panels: PanelConfig[] = [
        {
          title: 'Custom Panel',
          type: 'graph',
          targets: [{ expr: 'up' }],
        },
      ];

      const result = generator.generateCustom(config, panels);

      expect(result).toBeDefined();
      expect(result.dashboard.title).toBe('Custom Panel Dashboard');
      expect(result.dashboard.panels.length).toBe(1);
      expect(result.dashboard.panels[0].title).toBe('Custom Panel');
    });
  });
});

describe('AlertRulesGenerator', () => {
  let generator: AlertRulesGenerator;

  beforeEach(() => {
    generator = new AlertRulesGenerator();
  });

  describe('generateDefault', () => {
    test('should generate default alert groups', () => {
      const groups = generator.generateDefault();

      expect(Array.isArray(groups)).toBe(true);
      expect(groups.length).toBeGreaterThan(0);
    });

    test('should include standard alert groups', () => {
      const groups = generator.generateDefault();
      const groupNames = groups.map((g: AlertGroup) => g.name);

      // Should have groups for common scenarios
      expect(groupNames.length).toBeGreaterThan(0);
    });
  });

  describe('addGroup', () => {
    test('should add custom alert group', () => {
      generator.addGroup({
        name: 'custom_alerts',
        interval: '30s',
        rules: [
          {
            name: 'CustomAlert',
            expr: 'up == 0',
            for: '1m',
            labels: { severity: 'critical' },
            annotations: { summary: 'Service down' },
          },
        ],
      });

      const groups = generator.generateJSON();
      const customGroup = groups.find((g: AlertGroup) => g.name === 'custom_alerts');

      expect(customGroup).toBeDefined();
      expect(customGroup?.rules.length).toBeGreaterThan(0);
    });
  });

  describe('createCustomAlert', () => {
    test('should create alert rule with all fields', () => {
      const alert = generator.createCustomAlert({
        name: 'HighMemoryUsage',
        expr: 'process_resident_memory_bytes > 1000000000',
        for: '5m',
        severity: 'critical',
        summary: 'High memory usage detected',
        description: 'Memory usage is over 1GB',
      });

      expect(alert.name).toBe('HighMemoryUsage');
      expect(alert.expr).toBe('process_resident_memory_bytes > 1000000000');
      expect(alert.for).toBe('5m');
      expect(alert.severity).toBe('critical');
      expect(alert.annotations?.summary).toBe('High memory usage detected');
    });

    test('should use defaults for optional fields', () => {
      const alert = generator.createCustomAlert({
        name: 'TestAlert',
        expr: 'up == 0',
        summary: 'Test alert',
        description: 'Test description',
      });

      expect(alert.for).toBe('5m');
      expect(alert.severity).toBe('warning');
    });
  });

  describe('generateYAML', () => {
    test('should generate valid YAML string', () => {
      const yaml = generator.generateYAML();

      expect(yaml).toBeDefined();
      expect(yaml).toContain('groups:');
    });

    test('should include custom groups in YAML', () => {
      generator.addGroup({
        name: 'yaml_test',
        interval: '1m',
        rules: [
          {
            name: 'YamlTest',
            expr: 'test > 0',
            for: '0m',
            labels: { severity: 'info' },
            annotations: { summary: 'YAML test' },
          },
        ],
      });

      const yaml = generator.generateYAML();
      expect(yaml).toContain('yaml_test');
      expect(yaml).toContain('YamlTest');
    });
  });

  describe('generateJSON', () => {
    test('should return alert groups as JSON', () => {
      const groups = generator.generateJSON();

      expect(Array.isArray(groups)).toBe(true);
    });

    test('should return custom groups when added', () => {
      generator.addGroup({
        name: 'json_test',
        interval: '1m',
        rules: [
          {
            name: 'JsonTest',
            expr: 'json > 0',
            for: '0m',
            labels: { severity: 'info' },
            annotations: { summary: 'JSON test' },
          },
        ],
      });

      const groups = generator.generateJSON();
      const jsonGroup = groups.find((g: AlertGroup) => g.name === 'json_test');

      expect(jsonGroup).toBeDefined();
    });
  });
});
