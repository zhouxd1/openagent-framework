/**
 * 性能报告生成器
 * Performance Report Generator
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { BenchmarkReport, BenchmarkResult } from './benchmark-suite';
import type { PerformanceMetric } from './helpers';

/**
 * 报告格式选项
 */
export type ReportFormat = 'json' | 'markdown' | 'html';

/**
 * 生成器配置
 */
export interface ReportGeneratorOptions {
  outputDir: string;
  formats: ReportFormat[];
  includeTimestamp: boolean;
  compareWith?: string; // 之前的报告路径，用于对比
}

/**
 * 性能报告生成器
 */
export class ReportGenerator {
  private options: ReportGeneratorOptions;

  constructor(options: Partial<ReportGeneratorOptions> = {}) {
    this.options = {
      outputDir: options.outputDir || './performance-reports',
      formats: options.formats || ['json', 'markdown'],
      includeTimestamp: options.includeTimestamp ?? true,
      compareWith: options.compareWith,
    };
  }

  /**
   * 生成报告
   */
  generate(report: BenchmarkReport): string[] {
    // 确保输出目录存在
    mkdirSync(this.options.outputDir, { recursive: true });

    const outputFiles: string[] = [];
    const timestamp = this.options.includeTimestamp
      ? `-${new Date().toISOString().replace(/[:.]/g, '-')}`
      : '';

    for (const format of this.options.formats) {
      let content: string;
      let filename: string;

      switch (format) {
        case 'json':
          content = this.generateJSON(report);
          filename = `performance-report${timestamp}.json`;
          break;
        case 'markdown':
          content = this.generateMarkdown(report);
          filename = `performance-report${timestamp}.md`;
          break;
        case 'html':
          content = this.generateHTML(report);
          filename = `performance-report${timestamp}.html`;
          break;
        default:
          continue;
      }

      const filepath = join(this.options.outputDir, filename);
      writeFileSync(filepath, content, 'utf-8');
      outputFiles.push(filepath);
    }

    return outputFiles;
  }

  /**
   * 生成 JSON 报告
   */
  private generateJSON(report: BenchmarkReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * 生成 Markdown 报告
   */
  private generateMarkdown(report: BenchmarkReport): string {
    const lines: string[] = [];

    lines.push('# OpenAgent Framework Performance Report\n');

    // 元数据
    lines.push('## 📊 Test Summary\n');
    lines.push(`- **Timestamp**: ${report.timestamp}`);
    lines.push(`- **Node.js Version**: ${report.environment.nodeVersion}`);
    lines.push(`- **Platform**: ${report.environment.platform}`);
    lines.push(`- **CPUs**: ${report.environment.cpuCount}`);
    lines.push(`- **Total Memory**: ${report.environment.totalMemory.toFixed(2)} GB\n`);

    // 总体结果
    lines.push('## 📈 Results Overview\n');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Tests | ${report.summary.totalTests} |`);
    lines.push(`| ✅ Passed | ${report.summary.passed} |`);
    lines.push(`| ❌ Failed | ${report.summary.failed} |`);
    lines.push(`| ⏱️ Duration | ${report.summary.totalDuration}ms |`);
    lines.push(`| 💾 Peak Memory | ${report.summary.peakMemory.toFixed(2)} MB |\n`);

    // 详细结果
    lines.push('## 📋 Detailed Results\n');

    for (const result of report.results) {
      const emoji = result.passed ? '✅' : '❌';
      lines.push(`### ${emoji} ${result.name}\n`);
      lines.push(`**Category**: ${result.category}`);
      lines.push(`**Duration**: ${result.duration}ms\n`);

      // 性能指标
      if (result.metrics.length > 0) {
        lines.push('#### Performance Metrics\n');
        lines.push('| Metric | Value | Min | Max | Avg | P50 | P95 | P99 |');
        lines.push('|--------|-------|-----|-----|-----|-----|-----|-----|');

        for (const metric of result.metrics) {
          const row = [
            metric.name,
            `${metric.value.toFixed(2)} ${metric.unit}`,
            metric.min !== undefined ? metric.min.toFixed(2) : '-',
            metric.max !== undefined ? metric.max.toFixed(2) : '-',
            metric.avg !== undefined ? metric.avg.toFixed(2) : '-',
            metric.p50 !== undefined ? metric.p50.toFixed(2) : '-',
            metric.p95 !== undefined ? metric.p95.toFixed(2) : '-',
            metric.p99 !== undefined ? metric.p99.toFixed(2) : '-',
          ];
          lines.push(`| ${row.join(' | ')} |`);
        }
        lines.push('');
      }

      // 目标检查
      if (result.targets.length > 0) {
        lines.push('#### Performance Targets\n');
        lines.push('| Target | Expected | Actual | Status |');
        lines.push('|--------|----------|--------|--------|');

        for (const target of result.targets) {
          const status = target.passed ? '✅ Pass' : '❌ Fail';
          lines.push(
            `| ${target.metric} | ${target.target} ${target.unit} | ${target.actual.toFixed(2)} ${target.unit} | ${status} |`
          );
        }
        lines.push('');
      }

      // 内存影响
      lines.push('#### Memory Impact\n');
      lines.push('| Phase | Heap Used (MB) | Heap Total (MB) | RSS (MB) |');
      lines.push('|-------|----------------|-----------------|----------|');
      lines.push(
        `| Before | ${result.memoryImpact.before.heapUsed.toFixed(2)} | ${result.memoryImpact.before.heapTotal.toFixed(2)} | ${result.memoryImpact.before.rss.toFixed(2)} |`
      );
      lines.push(
        `| After | ${result.memoryImpact.after.heapUsed.toFixed(2)} | ${result.memoryImpact.after.heapTotal.toFixed(2)} | ${result.memoryImpact.after.rss.toFixed(2)} |`
      );
      lines.push(
        `| **Delta** | **${result.memoryImpact.delta.toFixed(2)}** | - | - |\n`
      );
    }

    // 建议
    if (report.recommendations.length > 0) {
      lines.push('## 💡 Recommendations\n');
      for (const rec of report.recommendations) {
        lines.push(`- ${rec}`);
      }
      lines.push('');
    } else {
      lines.push('## ✅ Conclusion\n');
      lines.push('All performance targets have been met. The framework is ready for production deployment.\n');
    }

    // 页脚
    lines.push('---');
    lines.push(`*Generated by OpenAgent Framework Performance Suite on ${report.timestamp}*`);

    return lines.join('\n');
  }

  /**
   * 生成 HTML 报告
   */
  private generateHTML(report: BenchmarkReport): string {
    const html: string[] = [];

    html.push('<!DOCTYPE html>');
    html.push('<html lang="en">');
    html.push('<head>');
    html.push('  <meta charset="UTF-8">');
    html.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
    html.push('  <title>OpenAgent Framework Performance Report</title>');
    html.push('  <style>');
    html.push(this.getHTMLStyles());
    html.push('  </style>');
    html.push('</head>');
    html.push('<body>');
    html.push('  <div class="container">');

    // 标题
    html.push('    <h1>🚀 OpenAgent Framework Performance Report</h1>');

    // 元数据
    html.push('    <div class="metadata">');
    html.push('      <h2>📊 Test Environment</h2>');
    html.push('      <div class="grid">');
    html.push(`        <div class="card"><strong>Timestamp</strong><br>${report.timestamp}</div>`);
    html.push(`        <div class="card"><strong>Node.js</strong><br>${report.environment.nodeVersion}</div>`);
    html.push(`        <div class="card"><strong>Platform</strong><br>${report.environment.platform}</div>`);
    html.push(`        <div class="card"><strong>CPUs</strong><br>${report.environment.cpuCount}</div>`);
    html.push('      </div>');
    html.push('    </div>');

    // 总体结果
    html.push('    <div class="summary">');
    html.push('      <h2>📈 Summary</h2>');
    html.push('      <div class="grid">');
    html.push(`        <div class="card ${report.summary.failed === 0 ? 'success' : 'warning'}">`);
    html.push(`          <div class="stat">${report.summary.passed}/${report.summary.totalTests}</div>`);
    html.push('          <div class="label">Tests Passed</div>');
    html.push('        </div>');
    html.push(`        <div class="card"><div class="stat">${report.summary.totalDuration}ms</div><div class="label">Duration</div></div>`);
    html.push(`        <div class="card"><div class="stat">${report.summary.peakMemory.toFixed(2)}MB</div><div class="label">Peak Memory</div></div>`);
    html.push('      </div>');
    html.push('    </div>');

    // 详细结果
    html.push('    <div class="results">');
    html.push('      <h2>📋 Detailed Results</h2>');

    for (const result of report.results) {
      const statusClass = result.passed ? 'passed' : 'failed';
      const emoji = result.passed ? '✅' : '❌';

      html.push(`      <div class="result-card ${statusClass}">`);
      html.push(`        <h3>${emoji} ${result.name}</h3>`);
      html.push(`        <span class="category">${result.category}</span>`);
      html.push(`        <span class="duration">${result.duration}ms</span>`);

      // 性能指标表格
      if (result.metrics.length > 0) {
        html.push('        <table class="metrics-table">');
        html.push('          <thead><tr><th>Metric</th><th>Value</th><th>Min</th><th>Max</th><th>P95</th></tr></thead>');
        html.push('          <tbody>');
        for (const metric of result.metrics) {
          html.push('            <tr>');
          html.push(`              <td>${metric.name}</td>`);
          html.push(`              <td>${metric.value.toFixed(2)} ${metric.unit}</td>`);
          html.push(`              <td>${metric.min?.toFixed(2) || '-'}</td>`);
          html.push(`              <td>${metric.max?.toFixed(2) || '-'}</td>`);
          html.push(`              <td>${metric.p95?.toFixed(2) || '-'}</td>`);
          html.push('            </tr>');
        }
        html.push('          </tbody>');
        html.push('        </table>');
      }

      // 目标检查
      if (result.targets.length > 0) {
        html.push('        <div class="targets">');
        for (const target of result.targets) {
          const targetClass = target.passed ? 'target-pass' : 'target-fail';
          html.push(`          <div class="target ${targetClass}">`);
          html.push(`            <span>${target.metric}</span>`);
          html.push(`            <span>${target.actual.toFixed(2)} / ${target.target} ${target.unit}</span>`);
          html.push(`            <span>${target.passed ? '✅' : '❌'}</span>`);
          html.push('          </div>');
        }
        html.push('        </div>');
      }

      html.push('      </div>');
    }

    html.push('    </div>');

    // 建议
    if (report.recommendations.length > 0) {
      html.push('    <div class="recommendations">');
      html.push('      <h2>💡 Recommendations</h2>');
      html.push('      <ul>');
      for (const rec of report.recommendations) {
        html.push(`        <li>${rec}</li>`);
      }
      html.push('      </ul>');
      html.push('    </div>');
    } else {
      html.push('    <div class="conclusion success">');
      html.push('      <h2>✅ All Targets Met</h2>');
      html.push('      <p>The framework meets all performance targets and is ready for production.</p>');
      html.push('    </div>');
    }

    html.push('  </div>');
    html.push('</body>');
    html.push('</html>');

    return html.join('\n');
  }

  /**
   * HTML 样式
   */
  private getHTMLStyles(): string {
    return `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; background: #f5f7fa; color: #333; line-height: 1.6; }
      .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
      h1 { text-align: center; margin-bottom: 30px; color: #2c3e50; }
      h2 { margin-bottom: 20px; color: #34495e; }
      h3 { margin-bottom: 10px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
      .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      .card.success { border-left: 4px solid #27ae60; }
      .card.warning { border-left: 4px solid #f39c12; }
      .stat { font-size: 2em; font-weight: bold; color: #2980b9; }
      .label { color: #7f8c8d; font-size: 0.9em; }
      .result-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      .result-card.passed { border-left: 4px solid #27ae60; }
      .result-card.failed { border-left: 4px solid #e74c3c; }
      .category { display: inline-block; background: #ecf0f1; padding: 4px 12px; border-radius: 4px; font-size: 0.85em; margin-right: 10px; }
      .duration { color: #7f8c8d; }
      .metrics-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
      .metrics-table th, .metrics-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ecf0f1; }
      .metrics-table th { background: #f8f9fa; font-weight: 600; }
      .targets { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px; }
      .target { display: flex; gap: 10px; padding: 8px 12px; border-radius: 4px; font-size: 0.9em; }
      .target-pass { background: #d4edda; color: #155724; }
      .target-fail { background: #f8d7da; color: #721c24; }
      .recommendations { background: #fff3cd; padding: 20px; border-radius: 8px; margin-top: 30px; }
      .recommendations ul { list-style-position: inside; }
      .recommendations li { margin-bottom: 10px; }
      .conclusion { background: #d4edda; padding: 30px; border-radius: 8px; text-align: center; margin-top: 30px; }
      .conclusion h2 { color: #155724; }
    `;
  }
}

/**
 * 简化的报告生成函数
 */
export function generatePerformanceReport(
  report: BenchmarkReport,
  outputDir?: string
): string[] {
  const generator = new ReportGenerator({ outputDir });
  return generator.generate(report);
}
