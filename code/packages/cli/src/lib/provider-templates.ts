/**
 * Provider Templates
 * 
 * Predefined configuration templates for common LLM providers
 */

import { ProviderConfig } from './config-manager';

/**
 * Provider configuration templates
 * These templates provide default values for common providers
 */
export const PROVIDER_TEMPLATES: Record<string, Partial<ProviderConfig>> = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4',
    timeout: 60000,
    maxRetries: 3,
  },
  
  zhipu: {
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
    defaultModel: 'glm-4',
    timeout: 60000,
    maxRetries: 3,
  },
  
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    timeout: 60000,
    maxRetries: 3,
  },
  
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-opus-20240229',
    timeout: 60000,
    maxRetries: 3,
  },
  
  ollama: {
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama2',
    timeout: 120000,
    maxRetries: 2,
  },
  
  moonshot: {
    baseURL: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    timeout: 60000,
    maxRetries: 3,
  },
  
  qwen: {
    baseURL: 'https://dashscope.aliyuncs.com/api/v1',
    defaultModel: 'qwen-turbo',
    timeout: 60000,
    maxRetries: 3,
  },
  
  yi: {
    baseURL: 'https://api.lingyiwanwu.com/v1',
    defaultModel: 'yi-large',
    timeout: 60000,
    maxRetries: 3,
  },
  
  baichuan: {
    baseURL: 'https://api.baichuan-ai.com/v1',
    defaultModel: 'Baichuan2-Turbo',
    timeout: 60000,
    maxRetries: 3,
  },
  
  minimax: {
    baseURL: 'https://api.minimax.chat/v1',
    defaultModel: 'abab5.5-chat',
    timeout: 60000,
    maxRetries: 3,
  },
};

/**
 * Get provider template by name
 */
export function getProviderTemplate(name: string): Partial<ProviderConfig> | undefined {
  return PROVIDER_TEMPLATES[name.toLowerCase()];
}

/**
 * Get list of supported provider names
 */
export function getSupportedProviders(): string[] {
  return Object.keys(PROVIDER_TEMPLATES);
}

/**
 * Check if a provider has a template
 */
export function hasProviderTemplate(name: string): boolean {
  return name.toLowerCase() in PROVIDER_TEMPLATES;
}

/**
 * Provider display names for better user experience
 */
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  zhipu: '智谱 GLM',
  deepseek: 'DeepSeek',
  anthropic: 'Anthropic Claude',
  ollama: 'Ollama (Local)',
  moonshot: 'Moonshot (月之暗面)',
  qwen: '通义千问',
  yi: '零一万物',
  baichuan: '百川',
  minimax: 'MiniMax',
};

/**
 * Get display name for a provider
 */
export function getProviderDisplayName(name: string): string {
  return PROVIDER_DISPLAY_NAMES[name.toLowerCase()] || name;
}

/**
 * Provider descriptions
 */
export const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  openai: 'GPT-4, GPT-3.5, and other OpenAI models',
  zhipu: 'GLM-4 and other Zhipu AI models',
  deepseek: 'DeepSeek Chat and Coder models',
  anthropic: 'Claude 3 family of models',
  ollama: 'Run open-source models locally',
  moonshot: 'Moonshot AI models with long context',
  qwen: 'Alibaba\'s Qwen family of models',
  yi: '01.AI\'s Yi series models',
  baichuan: 'Baichuan AI models',
  minimax: 'MiniMax AI models',
};

/**
 * Get provider description
 */
export function getProviderDescription(name: string): string {
  return PROVIDER_DESCRIPTIONS[name.toLowerCase()] || 'Custom provider';
}
