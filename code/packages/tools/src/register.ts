/**
 * Tool Registration Helper
 */

import { ToolExecutor } from '@openagent/core';
import { weatherToolDefinition, weatherToolHandler, weatherSchema } from './builtin/weather-tool';
import {
  calculatorToolDefinition,
  calculatorToolHandler,
  calculatorSchema,
} from './builtin/calculator-tool';

/**
 * Register all builtin tools with a tool executor
 */
export function registerBuiltinTools(executor: ToolExecutor): void {
  // Register weather tool with schema
  executor.register(weatherToolDefinition, weatherToolHandler, weatherSchema);

  // Register calculator tool with schema
  executor.register(calculatorToolDefinition, calculatorToolHandler, calculatorSchema);

  // Add more builtin tools here as they are created
}

/**
 * Create a tool executor with builtin tools registered
 */
export function createToolExecutor(): ToolExecutor {
  const executor = new ToolExecutor();
  registerBuiltinTools(executor);
  return executor;
}
