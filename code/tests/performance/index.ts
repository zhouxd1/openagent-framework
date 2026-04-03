/**
 * 性能测试套件主入口
 * Performance Test Suite Main Entry
 */

export * from './helpers';
export * from './memory-monitor';
export * from './benchmark-suite';
export * from './report-generator';
export * from './optimization-tools';

import { BenchmarkSuite, runBenchmarks, BenchmarkReport } from './benchmark-suite';
import { ReportGenerator, generatePerformanceReport } from './report-generator';
import { MemoryMonitor } from './memory-monitor';

/**
 * 性能测试配置
 */
export interface PerformanceTestConfig {
  outputDir?: string;
  formats?: ('json' | 'markdown' | 'html')[];
  verbose?: boolean;
}

/**
 * 运行完整的性能测试并生成报告
 */
export async function runPerformanceTests(
  config: PerformanceTestConfig = {}
): Promise<{
  report: BenchmarkReport;
  outputFiles: string[];
}> {
  console.log('🚀 Starting OpenAgent Framework Performance Test Suite\n');

  // 运行基准测试
  const suite = new BenchmarkSuite();
  const report = await suite.runAll();

  // 生成报告
  const generator = new ReportGenerator({
    outputDir: config.outputDir || './performance-reports',
    formats: config.formats || ['json', 'markdown', 'html'],
    includeTimestamp: true,
  });

  const outputFiles = generator.generate(report);

  // 打印输出文件
  console.log('\n📄 Reports generated:');
  outputFiles.forEach(file => {
    console.log(`   - ${file}`);
  });

  return { report, outputFiles };
}

/**
 * 快速性能检查
 * 只运行核心测试，用于 CI/CD
 */
export async function quickPerformanceCheck(): Promise<boolean> {
  console.log('⚡ Running quick performance check...\n');

  const suite = new BenchmarkSuite();
  const report = await suite.runAll();

  const allPassed = report.summary.failed === 0;

  if (allPassed) {
    console.log('✅ All performance targets met!');
  } else {
    console.log('❌ Some performance targets not met. Check the full report for details.');
    report.recommendations.forEach(rec => console.log(`   ${rec}`));
  }

  return allPassed;
}

// 如果直接运行此文件
if (require.main === module) {
  runPerformanceTests({
    outputDir: './performance-reports',
    formats: ['json', 'markdown', 'html'],
    verbose: true,
  }).catch(console.error);
}
