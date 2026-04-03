/**
 * Example Tool: Calculator
 * 
 * Security Note: This implementation uses a safe expression parser
 * that does NOT use eval() or new Function(), preventing code injection.
 */

import { 
  ToolDefinition, 
  ToolExecutionResult, 
  ToolExecutionContext,
  Parameters,
  Validator,
} from '@openagent/core';
import { z } from 'zod';

/**
 * Calculator tool parameter schema
 */
export const calculatorSchema = z.object({
  expression: z.string()
    .min(1, 'Expression cannot be empty')
    .max(200, 'Expression too long (max 200 characters)')
    .regex(/^[\d\s+\-*/().]+$/, 'Expression contains invalid characters. Only numbers, +, -, *, /, (, ) are allowed'),
});

export type CalculatorParams = z.infer<typeof calculatorSchema>;

export const calculatorToolDefinition: ToolDefinition = {
  name: 'calculator',
  description: 'Perform mathematical calculations',
  category: 'utility',
  parameters: {
    expression: {
      type: 'string',
      description: 'Mathematical expression to evaluate (e.g., "2 + 2", "10 * 5")',
      required: true,
    },
  },
  returns: {
    type: 'number',
    description: 'Result of the calculation',
  },
};

/**
 * Safe mathematical expression parser
 * Supports: +, -, *, /, parentheses, decimals, and spaces
 * Does NOT use eval() or new Function() - prevents code injection
 */
class SafeMathParser {
  private tokens: string[] = [];
  private current = 0;

  parse(expression: string): number {
    // Tokenize the expression
    this.tokens = this.tokenize(expression);
    this.current = 0;
    
    const result = this.parseExpression();
    
    if (this.current < this.tokens.length) {
      throw new Error('Unexpected token: ' + this.tokens[this.current]);
    }
    
    return result;
  }

  private tokenize(expression: string): string[] {
    const tokens: string[] = [];
    let i = 0;
    
    while (i < expression.length) {
      const char = expression[i];
      
      // Skip whitespace
      if (/\s/.test(char)) {
        i++;
        continue;
      }
      
      // Numbers (including decimals)
      if (/\d/.test(char) || (char === '.' && i + 1 < expression.length && /\d/.test(expression[i + 1]))) {
        let num = '';
        while (i < expression.length && (/\d/.test(expression[i]) || expression[i] === '.')) {
          num += expression[i];
          i++;
        }
        tokens.push(num);
        continue;
      }
      
      // Operators and parentheses
      if (['+', '-', '*', '/', '(', ')'].includes(char)) {
        tokens.push(char);
        i++;
        continue;
      }
      
      throw new Error(`Invalid character: ${char}`);
    }
    
    return tokens;
  }

  private parseExpression(): number {
    let result = this.parseTerm();
    
    while (this.current < this.tokens.length && (this.tokens[this.current] === '+' || this.tokens[this.current] === '-')) {
      const operator = this.tokens[this.current];
      this.current++;
      const right = this.parseTerm();
      
      if (operator === '+') {
        result += right;
      } else {
        result -= right;
      }
    }
    
    return result;
  }

  private parseTerm(): number {
    let result = this.parseFactor();
    
    while (this.current < this.tokens.length && (this.tokens[this.current] === '*' || this.tokens[this.current] === '/')) {
      const operator = this.tokens[this.current];
      this.current++;
      const right = this.parseFactor();
      
      if (operator === '*') {
        result *= right;
      } else {
        if (right === 0) {
          throw new Error('Division by zero');
        }
        result /= right;
      }
    }
    
    return result;
  }

  private parseFactor(): number {
    const token = this.tokens[this.current];
    
    if (token === '(') {
      this.current++;
      const result = this.parseExpression();
      if (this.tokens[this.current] !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      this.current++;
      return result;
    }
    
    if (token === '-') {
      this.current++;
      return -this.parseFactor();
    }
    
    if (token === '+') {
      this.current++;
      return this.parseFactor();
    }
    
    // Number
    this.current++;
    const num = parseFloat(token);
    if (isNaN(num)) {
      throw new Error(`Invalid number: ${token}`);
    }
    return num;
  }
}

export async function calculatorToolHandler(
  parameters: Parameters,
  _context?: ToolExecutionContext
): Promise<ToolExecutionResult> {
  try {
    // Validate parameters
    const validation = Validator.safeValidate(calculatorSchema, parameters);
    
    if (!validation.success) {
      const errorMessage = validation.errors?.map(e => `${e.path}: ${e.message}`).join('; ') || 'Validation failed';
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { expression } = validation.data!;

    // Use safe math parser instead of new Function()
    const parser = new SafeMathParser();
    const result = parser.parse(expression);

    if (typeof result !== 'number' || !isFinite(result)) {
      return {
        success: false,
        error: 'Invalid calculation result',
      };
    }

    return {
      success: true,
      data: result,
      metadata: {
        expression,
        evaluatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Calculation failed',
    };
  }
}
