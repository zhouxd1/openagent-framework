/**
 * Prisma Database Module
 */

export {
  createPrismaClient,
  getPrismaClient,
  getQueryMetrics,
  resetQueryMetrics,
  getPerformanceReport,
  disconnectPrisma,
  checkDatabaseHealth,
  prisma,
} from './client';
