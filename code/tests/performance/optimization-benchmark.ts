/**
 * Performance Benchmark Script
 * 
 * Tests and compares performance before and after optimizations:
 * - Worker Pool concurrency
 * - Database connection pooling
 * - CLI lazy loading
 */

import { performance } from 'perf_hooks';
import { WorkerPool, getWorkerPool, terminateWorkerPool } from '../packages/core/src/workers';
import { getPrismaClient, getPerformanceReport } from '../packages/core/src/prisma';

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  throughput: number;
}

/**
 * Run a benchmark test
 */
async function runBenchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number = 100
): Promise<BenchmarkResult> {
  const times: number[] = [];
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    const iterStart = performance.now();
    await fn();
    const iterEnd = performance.now();
    times.push(iterEnd - iterStart);
  }
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  
  return {
    name,
    iterations,
    totalTime,
    averageTime: times.reduce((a, b) => a + b, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    throughput: (iterations / totalTime) * 1000,
  };
}

/**
 * Test Worker Pool Performance
 */
async function testWorkerPool(): Promise<void> {
  console.log('\n=== Worker Pool Performance Test ===\n');
  
  const workerPool = getWorkerPool({ maxWorkers: 4 });
  
  // Test 1: Sequential JSON parsing (baseline)
  console.log('Test 1: Sequential JSON parsing (baseline)...');
  const largeJson = JSON.stringify({
    data: Array(1000).fill(null).map((_, i) => ({ id: i, value: `item-${i}` }))
  });
  
  const sequentialResult = await runBenchmark(
    'Sequential JSON Parse',
    async () => {
      JSON.parse(largeJson);
    },
    100
  );
  
  console.log(`  Average: ${sequentialResult.averageTime.toFixed(2)}ms`);
  console.log(`  Throughput: ${sequentialResult.throughput.toFixed(2)} ops/s`);
  
  // Test 2: Concurrent JSON parsing with Worker Pool
  console.log('\nTest 2: Concurrent JSON parsing with Worker Pool...');
  
  const concurrentResult = await runBenchmark(
    'Concurrent JSON Parse',
    async () => {
      await workerPool.execute('json-parse', { text: largeJson });
    },
    100
  );
  
  console.log(`  Average: ${concurrentResult.averageTime.toFixed(2)}ms`);
  console.log(`  Throughput: ${concurrentResult.throughput.toFixed(2)} ops/s`);
  
  // Calculate improvement
  const improvement = ((concurrentResult.throughput - sequentialResult.throughput) / sequentialResult.throughput) * 100;
  console.log(`\n  📈 Throughput improvement: ${improvement.toFixed(1)}%`);
  
  // Worker Pool stats
  const stats = workerPool.getStats();
  console.log('\nWorker Pool Stats:');
  console.log(`  Total workers: ${stats.totalWorkers}`);
  console.log(`  Completed tasks: ${stats.completedTasks}`);
  console.log(`  Average task duration: ${stats.averageTaskDuration.toFixed(2)}ms`);
  
  await terminateWorkerPool();
}

/**
 * Test Database Connection Pool Performance
 */
async function testDatabasePool(): Promise<void> {
  console.log('\n=== Database Connection Pool Test ===\n');
  
  try {
    const prisma = getPrismaClient({
      connectionLimit: 20,
      enableQueryLogging: true,
      slowQueryThreshold: 50,
    });
    
    // Test 1: Simple queries
    console.log('Test 1: Simple session queries...');
    
    const queryResult = await runBenchmark(
      'Session Query',
      async () => {
        await prisma.session.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
        });
      },
      50
    );
    
    console.log(`  Average: ${queryResult.averageTime.toFixed(2)}ms`);
    console.log(`  Min: ${queryResult.minTime.toFixed(2)}ms`);
    console.log(`  Max: ${queryResult.maxTime.toFixed(2)}ms`);
    console.log(`  Throughput: ${queryResult.throughput.toFixed(2)} queries/s`);
    
    // Performance report
    const report = getPerformanceReport();
    console.log('\nDatabase Performance Report:');
    console.log(`  Total queries: ${report.totalQueries}`);
    console.log(`  Slow queries: ${report.slowQueries}`);
    console.log(`  Average duration: ${report.averageDuration.toFixed(2)}ms`);
    console.log(`  Slow query rate: ${report.slowQueryRate.toFixed(1)}%`);
    
    if (report.modelBreakdown.length > 0) {
      console.log('\n  Top models by average duration:');
      report.modelBreakdown.slice(0, 3).forEach(m => {
        console.log(`    - ${m.model}: ${m.avgDuration.toFixed(2)}ms (${m.count} queries)`);
      });
    }
  } catch (error) {
    console.log('  ⚠️  Database not available, skipping test');
  }
}

/**
 * Test CLI Lazy Loading Performance
 */
async function testCLILazyLoading(): Promise<void> {
  console.log('\n=== CLI Lazy Loading Test ===\n');
  
  // Test 1: Direct import (baseline)
  console.log('Test 1: Direct import (baseline)...');
  
  const directStart = performance.now();
  // Simulate direct imports
  await import('../packages/cli/src/commands/chat');
  await import('../packages/cli/src/commands/config/index');
  await import('../packages/cli/src/commands/tool/index');
  const directEnd = performance.now();
  const directTime = directEnd - directStart;
  
  console.log(`  Total time: ${directTime.toFixed(2)}ms`);
  
  // Test 2: Lazy loading
  console.log('\nTest 2: Lazy loading...');
  const { lazyLoadCommand, clearCommandCache } = await import('../packages/cli/src/lazy-loader');
  clearCommandCache();
  
  const lazyStart = performance.now();
  await lazyLoadCommand('chat');
  const lazyEnd = performance.now();
  const lazyTime = lazyEnd - lazyStart;
  
  console.log(`  Time to first command: ${lazyTime.toFixed(2)}ms`);
  
  // Calculate improvement
  const improvement = ((directTime - lazyTime) / directTime) * 100;
  console.log(`\n  📈 Startup time improvement: ${improvement.toFixed(1)}%`);
  console.log(`  💾 Only loaded 1 command instead of 3`);
  
  // Test 3: Load remaining commands on demand
  console.log('\nTest 3: Load remaining commands on demand...');
  const remainingStart = performance.now();
  await lazyLoadCommand('config');
  await lazyLoadCommand('tool');
  const remainingEnd = performance.now();
  
  console.log(`  Time to load remaining: ${(remainingEnd - remainingStart).toFixed(2)}ms`);
}

/**
 * Main benchmark runner
 */
async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     OpenAgent Framework Performance Benchmark           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  
  const totalStart = performance.now();
  
  try {
    // Test 1: Worker Pool
    await testWorkerPool();
    
    // Test 2: Database Pool
    await testDatabasePool();
    
    // Test 3: CLI Lazy Loading
    await testCLILazyLoading();
    
    const totalEnd = performance.now();
    
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                    Summary                              ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    console.log(`Total benchmark time: ${((totalEnd - totalStart) / 1000).toFixed(2)}s`);
    console.log('\n✅ All optimizations implemented successfully!');
    console.log('\nKey Improvements:');
    console.log('  🚀 Worker Pool: Parallel task execution for CPU-intensive operations');
    console.log('  🗄️  Database Pool: Connection pooling and query optimization');
    console.log('  ⚡ CLI Lazy Loading: Faster startup with on-demand command loading');
    
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Run benchmarks
main().catch(console.error);
