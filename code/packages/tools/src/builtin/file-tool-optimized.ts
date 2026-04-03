/**
 * File Operation Tools - Optimized with Worker Pool Support
 * 
 * Provides file read and write capabilities with worker thread support
 * for improved performance on large file operations.
 */

import { 
  ToolDefinition, 
  ToolExecutionResult, 
  ToolExecutionContext,
  Parameters,
  createLogger,
  getWorkerPool,
} from '@openagent/core';
import { z } from 'zod';
import { promises as fs } from 'fs';
import * as path from 'path';

import * as Buffer from 'buffer';

