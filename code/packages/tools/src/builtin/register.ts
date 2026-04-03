/**
 * Tool Registration Helper
 * 
 * Registers all builtin tools with an executor.
 */

import { IToolExecutor } from '@openagent/core';

// Import tool definitions and handlers
import { 
  fileReadToolDefinition,
  fileReadHandler,
  fileWriteToolDefinition,
  fileWriteHandler,
} from './file-tool';
import {
  httpRequestToolDefinition,
  httpRequestHandler,
} from './http-tool';
import {
  shellExecToolDefinition,
  shellExecHandler,
} from './shell-tool';
import {
  jsonParseToolDefinition,
  jsonParseHandler,
  jsonStringifyToolDefinition,
  jsonStringifyHandler,
} from './json-tool';
import {
  calculatorToolDefinition,
  calculatorToolHandler,
} from './calculator-tool';
import {
  weatherToolDefinition,
  weatherToolHandler,
} from './weather-tool';

/**
 * Register all builtin tools with an executor
 */
export function registerBuiltinTools(executor: IToolExecutor): void {
  // File tools
  executor.register(fileReadToolDefinition, fileReadHandler);
  executor.register(fileWriteToolDefinition, fileWriteHandler);
  
  // HTTP tool
  executor.register(httpRequestToolDefinition, httpRequestHandler);
  
  // Shell tool
  executor.register(shellExecToolDefinition, shellExecHandler);
  
  // JSON tools
  executor.register(jsonParseToolDefinition, jsonParseHandler);
  executor.register(jsonStringifyToolDefinition, jsonStringifyHandler);
  
  // Calculator tool
  executor.register(calculatorToolDefinition, calculatorToolHandler);
  
  // Weather tool
  executor.register(weatherToolDefinition, weatherToolHandler);
}
