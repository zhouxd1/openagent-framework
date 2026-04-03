import { ReActAgent, AgentConfig, Tool } from '@openagent/core';
import { OpenAIAdapter } from '@openagent/llm-openai';
import * as dotenv from 'dotenv';

dotenv.config();

// Tool: Analyze Code
const analyzeCodeTool: Tool = {
  name: 'analyze_code',
  description: 'Analyze code for issues, improvements, and best practices',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to analyze',
      },
      language: {
        type: 'string',
        description: 'Programming language',
        enum: ['javascript', 'typescript', 'python', 'java', 'go'],
      },
    },
    required: ['code'],
  },
  execute: async (params) => {
    const { code, language = 'javascript' } = params;
    
    // Simple analysis (in production, use proper linting tools)
    const analysis = {
      issues: [],
      suggestions: [],
      score: 100,
    };
    
    // Check for common issues
    if (code.includes('var ')) {
      analysis.issues.push('Use of var - prefer const or let');
      analysis.score -= 10;
    }
    
    if (code.includes('console.log')) {
      analysis.suggestions.push('Remove console.log statements in production');
      analysis.score -= 5;
    }
    
    if (!code.includes('function') && !code.includes('=>')) {
      analysis.issues.push('No function definition found');
    }
    
    // Check code length
    if (code.length > 500) {
      analysis.suggestions.push('Consider breaking into smaller functions');
    }
    
    return {
      success: true,
      data: {
        language,
        lineCount: code.split('\n').length,
        analysis,
      },
    };
  },
};

// Tool: Format Code
const formatCodeTool: Tool = {
  name: 'format_code',
  description: 'Format code according to language best practices',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to format',
      },
      language: {
        type: 'string',
        description: 'Programming language',
      },
    },
    required: ['code', 'language'],
  },
  execute: async (params) => {
    const { code, language } = params;
    
    // Simple formatting (in production, use prettier, black, etc.)
    let formatted = code;
    
    // Basic formatting rules
    formatted = formatted.trim();
    
    // Add proper indentation (simplified)
    const lines = formatted.split('\n');
    let indent = 0;
    const formattedLines = lines.map(line => {
      line = line.trim();
      if (line.endsWith('}')) indent = Math.max(0, indent - 2);
      const result = ' '.repeat(indent) + line;
      if (line.endsWith('{')) indent += 2;
      return result;
    });
    
    return {
      success: true,
      data: {
        original: code,
        formatted: formattedLines.join('\n'),
        language,
      },
    };
  },
};

// Tool: Detect Language
const detectLanguageTool: Tool = {
  name: 'detect_language',
  description: 'Detect the programming language of code',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to analyze',
      },
    },
    required: ['code'],
  },
  execute: async (params) => {
    const { code } = params;
    
    // Simple detection based on keywords
    const indicators: Record<string, string[]> = {
      typescript: [': string', ': number', ': boolean', 'interface '],
      javascript: ['const ', 'let ', '=>', 'function '],
      python: ['def ', 'import ', 'print(', ':\\s*#'],
      java: ['public class', 'private ', 'void '],
      go: ['func ', 'package ', 'fmt.'],
    };
    
    let detected = 'unknown';
    let maxScore = 0;
    
    for (const [lang, keywords] of Object.entries(indicators)) {
      let score = 0;
      for (const keyword of keywords) {
        if (code.includes(keyword)) score++;
      }
      if (score > maxScore) {
        maxScore = score;
        detected = lang;
      }
    }
    
    return {
      success: true,
      data: {
        language: detected,
        confidence: maxScore > 0 ? 0.8 : 0.3,
      },
    };
  },
};

// Create LLM adapter
const llm = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4-turbo-preview',
});

// Agent configuration
const config: AgentConfig = {
  id: 'code-assistant',
  name: 'Code Assistant',
  provider: 'openai',
  mode: 'react',
  systemPrompt: `You are an expert code assistant specialized in code analysis, formatting, and improvement.
You help developers write better code by:
- Analyzing code for issues and improvements
- Formatting code according to best practices
- Suggesting optimizations and best practices
- Explaining code concepts

Always provide clear, actionable advice.`,
  tools: [analyzeCodeTool, formatCodeTool, detectLanguageTool],
  maxIterations: 10,
};

// Create and run agent
async function main() {
  const agent = new ReActAgent(config);
  await agent.initialize();
  
  // Example: Analyze code
  const result = await agent.run(
    'Analyze this code: function foo(x) { var y = x * 2; console.log(y); return y; }'
  );
  
  console.log(result.message);
}

main().catch(console.error);
