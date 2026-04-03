/**
 * Tests for Calculator Tool
 */

import { describe, it, expect } from 'vitest';
import {
  calculatorToolDefinition,
  calculatorToolHandler,
} from '../src/builtin/calculator-tool';

describe('calculatorToolDefinition', () => {
  it('should have correct name', () => {
    expect(calculatorToolDefinition.name).toBe('calculator');
  });

  it('should have required expression parameter', () => {
    expect(calculatorToolDefinition.parameters.expression.required).toBe(true);
    expect(calculatorToolDefinition.parameters.expression.type).toBe('string');
  });

  it('should be utility category', () => {
    expect(calculatorToolDefinition.category).toBe('utility');
  });
});

describe('calculatorToolHandler', () => {
  describe('basic arithmetic', () => {
    it('should add two numbers', async () => {
      const result = await calculatorToolHandler({ expression: '2 + 3' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(5);
    });

    it('should subtract two numbers', async () => {
      const result = await calculatorToolHandler({ expression: '10 - 4' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(6);
    });

    it('should multiply two numbers', async () => {
      const result = await calculatorToolHandler({ expression: '6 * 7' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });

    it('should divide two numbers', async () => {
      const result = await calculatorToolHandler({ expression: '20 / 5' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(4);
    });
  });

  describe('operator precedence', () => {
    it('should respect operator precedence', async () => {
      const result = await calculatorToolHandler({ expression: '2 + 3 * 4' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(14); // 3 * 4 = 12, + 2 = 14
    });

    it('should handle parentheses', async () => {
      const result = await calculatorToolHandler({ expression: '(2 + 3) * 4' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(20); // 2 + 3 = 5, * 4 = 20
    });

    it('should handle nested parentheses', async () => {
      const result = await calculatorToolHandler({ expression: '((2 + 3) * (4 - 1))' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(15); // 5 * 3 = 15
    });
  });

  describe('complex expressions', () => {
    it('should handle multiple operations', async () => {
      const result = await calculatorToolHandler({ expression: '10 + 5 * 2 - 8 / 4' });
      
      expect(result.success).toBe(true);
      // 5 * 2 = 10, 8 / 4 = 2
      // 10 + 10 - 2 = 18
      expect(result.data).toBe(18);
    });

    it('should handle decimal numbers', async () => {
      const result = await calculatorToolHandler({ expression: '3.14 * 2' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeCloseTo(6.28);
    });

    it('should handle negative numbers', async () => {
      const result = await calculatorToolHandler({ expression: '-5 + 3' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(-2);
    });
  });

  describe('error handling', () => {
    it('should reject non-string expression', async () => {
      const result = await calculatorToolHandler({ expression: 123 });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/string/i);
    });

    it('should reject invalid characters', async () => {
      const result = await calculatorToolHandler({ expression: '2 + abc' });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid.*character/i);
    });

    it('should handle division by zero', async () => {
      const result = await calculatorToolHandler({ expression: '10 / 0' });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/division.*zero/i);
    });

    it('should handle mismatched parentheses', async () => {
      const result = await calculatorToolHandler({ expression: '(2 + 3' });
      
      expect(result.success).toBe(false);
    });

    it('should handle empty expression', async () => {
      const result = await calculatorToolHandler({ expression: '' });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/empty/i);
    });
  });

  describe('metadata', () => {
    it('should include expression in metadata', async () => {
      const result = await calculatorToolHandler({ expression: '2 + 2' });
      
      expect(result.success).toBe(true);
      expect(result.metadata?.expression).toBe('2 + 2');
      expect(result.metadata?.evaluatedAt).toBeDefined();
    });
  });

  describe('security', () => {
    it('should NOT execute code injection attempts', async () => {
      const result = await calculatorToolHandler({ 
        expression: 'console.log("hacked")' 
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid.*character/i);
    });

    it('should NOT allow function calls', async () => {
      const result = await calculatorToolHandler({ 
        expression: 'eval("process.exit()")' 
      });
      
      expect(result.success).toBe(false);
    });
  });
});
