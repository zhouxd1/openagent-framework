/**
 * Config Manager
 * 
 * Manages CLI configuration including:
 * - API keys
 * - Default model/provider
 * - Multi-provider configuration
 * - Tool settings
 * - Output format
 * 
 * Configuration file path: ~/.openagent/config.json
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

/**
 * Provider configuration interface
 */
export interface ProviderConfig {
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
  organization?: string; // OpenAI organization
  timeout?: number;
  maxRetries?: number;
}

/**
 * Main configuration interface
 */
export interface Config {
  // Default provider
  defaultProvider?: string;
  
  // Multi-provider configuration
  providers?: Record<string, ProviderConfig>;
  
  // Backward compatibility: single API Key configuration
  apiKeys?: Record<string, string>;
  
  // Other configurations
  defaultModel?: string;
  tools?: {
    enabled?: string[];
    disabled?: string[];
  };
  output?: {
    format?: 'text' | 'json';
    color?: boolean;
  };
  history?: {
    enabled?: boolean;
    maxSize?: number;
  };
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Config = {
  defaultProvider: 'openai',
  providers: {},
  output: {
    format: 'text',
    color: true,
  },
  history: {
    enabled: true,
    maxSize: 1000,
  },
};

/**
 * Config Manager class
 */
export class ConfigManager {
  private static configPath: string = path.join(os.homedir(), '.openagent', 'config.json');
  private static configCache: Config | null = null;

  /**
   * Get configuration file path
   */
  static getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Load configuration from file
   */
  static async load(): Promise<Config> {
    try {
      // Return cached config if available
      if (this.configCache) {
        return { ...DEFAULT_CONFIG, ...this.configCache };
      }

      // Check if config file exists
      if (!(await fs.pathExists(this.configPath))) {
        // Create default config file
        await this.save(DEFAULT_CONFIG);
        return { ...DEFAULT_CONFIG };
      }

      // Read and parse config file
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      // Cache the config
      this.configCache = config;
      
      // Merge with defaults
      return { ...DEFAULT_CONFIG, ...config };
    } catch (error) {
      console.error('Failed to load config:', error);
      // Return default config on error
      return { ...DEFAULT_CONFIG };
    }
  }

  /**
   * Save configuration to file
   */
  static async save(config: Config): Promise<void> {
    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.configPath);
      await fs.ensureDir(configDir);

      // Write config file
      await fs.writeFile(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );

      // Update cache
      this.configCache = config;
    } catch (error) {
      throw new Error(`Failed to save config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a configuration value by key (supports dot notation)
   */
  static async get<T = any>(key?: string): Promise<T | undefined> {
    const config = await this.load();
    
    if (!key) {
      return config as any;
    }

    // Support dot notation
    const keys = key.split('.');
    let value: any = config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return value as T;
  }

  /**
   * Set a configuration value by key (supports dot notation)
   */
  static async set(key: string, value: any): Promise<void> {
    const config = await this.load();
    
    // Support dot notation
    const keys = key.split('.');
    let current: any = config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current)) {
        current[k] = {};
      }
      current = current[k];
    }

    current[keys[keys.length - 1]] = value;
    await this.save(config);
  }

  /**
   * Get provider configuration
   * Priority: providers[name] > apiKeys[name] > environment variable
   */
  static async getProvider(name: string): Promise<ProviderConfig> {
    const config = await this.load();
    
    // 1. Get from providers configuration
    if (config.providers?.[name]) {
      return {
        ...config.providers[name],
        // API Key can be overridden by environment variable
        apiKey: process.env[`${name.toUpperCase()}_API_KEY`] || process.env.OPENAI_API_KEY || config.providers[name].apiKey,
      };
    }
    
    // 2. Backward compatibility: get from apiKeys
    if (config.apiKeys?.[name]) {
      return {
        apiKey: process.env[`${name.toUpperCase()}_API_KEY`] || process.env.OPENAI_API_KEY || config.apiKeys[name],
      };
    }
    
    // 3. Get from environment variable
    const apiKey = process.env[`${name.toUpperCase()}_API_KEY`] || process.env.OPENAI_API_KEY;
    if (apiKey) {
      return { apiKey };
    }
    
    throw new Error(
      `Provider "${name}" is not configured.\n` +
      `Please add it using: openagent provider add ${name}\n` +
      `Or set the environment variable: ${name.toUpperCase()}_API_KEY`
    );
  }

  /**
   * Add a provider
   */
  static async addProvider(name: string, providerConfig: ProviderConfig): Promise<void> {
    const config = await this.load();
    
    if (!config.providers) {
      config.providers = {};
    }
    
    config.providers[name] = providerConfig;
    
    // If this is the first provider, set it as default
    if (Object.keys(config.providers).length === 1) {
      config.defaultProvider = name;
    }
    
    await this.save(config);
  }

  /**
   * Remove a provider
   */
  static async removeProvider(name: string): Promise<void> {
    const config = await this.load();
    
    if (config.providers?.[name]) {
      delete config.providers[name];
      
      // If removed provider was default, reset default
      if (config.defaultProvider === name) {
        const remainingProviders = Object.keys(config.providers || {});
        config.defaultProvider = remainingProviders[0] || 'openai';
      }
      
      await this.save(config);
    } else {
      throw new Error(`Provider "${name}" does not exist`);
    }
  }

  /**
   * Set default provider
   */
  static async setDefaultProvider(name: string): Promise<void> {
    const config = await this.load();
    
    // Verify provider exists
    if (!config.providers?.[name] && !config.apiKeys?.[name]) {
      throw new Error(
        `Provider "${name}" does not exist.\n` +
        `Available providers: ${Object.keys(config.providers || {}).join(', ') || 'none'}`
      );
    }
    
    config.defaultProvider = name;
    await this.save(config);
  }

  /**
   * Get API key for a provider (backward compatibility)
   */
  static async getApiKey(provider: string = 'openai'): Promise<string | undefined> {
    try {
      const providerConfig = await this.getProvider(provider);
      return providerConfig.apiKey;
    } catch {
      return undefined;
    }
  }

  /**
   * Set API key for a provider (backward compatibility)
   */
  static async setApiKey(provider: string, apiKey: string): Promise<void> {
    const config = await this.load();
    
    if (!config.apiKeys) {
      config.apiKeys = {};
    }
    
    config.apiKeys[provider] = apiKey;
    await this.save(config);
  }

  /**
   * Clear configuration cache
   */
  static clearCache(): void {
    this.configCache = null;
  }

  /**
   * Check if provider exists
   */
  static async hasProvider(name: string): Promise<boolean> {
    const config = await this.load();
    return !!(config.providers?.[name] || config.apiKeys?.[name]);
  }

  /**
   * Get all provider names
   */
  static async getProviderNames(): Promise<string[]> {
    const config = await this.load();
    const providers = new Set<string>();
    
    // Add providers from providers config
    if (config.providers) {
      Object.keys(config.providers).forEach(p => providers.add(p));
    }
    
    // Add providers from apiKeys (backward compatibility)
    if (config.apiKeys) {
      Object.keys(config.apiKeys).forEach(p => providers.add(p));
    }
    
    return Array.from(providers);
  }
}
