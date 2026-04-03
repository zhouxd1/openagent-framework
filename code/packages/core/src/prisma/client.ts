/**
 * Optimized Prisma Client with Connection Pooling
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '../logger';

const logger = createLogger('PrismaClient');

/**
 * Prisma client configuration
 */
interface PrismaClientConfig {
  connectionLimit?: number;
  poolTimeout?: number;
  enableQueryLogging?: boolean;
  slowQueryThreshold?: number;
  enableMetrics?: boolean;
}

/**
 * Query metrics
 */
interface QueryMetrics {
  totalQueries: number;
  slowQueries: number;
  averageDuration: number;
  modelStats: Map<string, { count: number; totalDuration: number }>;
}

const queryMetrics: QueryMetrics = {
  totalQueries: 0,
  slowQueries: 0,
  averageDuration: 0,
  modelStats: new Map(),
};

/**
 * Global Prisma client instance
 */
let prismaClient: PrismaClient | null = null;

