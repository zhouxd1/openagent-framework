/**
 * CLI Lazy Loader - Optimized Command Loading
 * 
 * Implements lazy loading for CLI commands to reduce startup time
 * and memory usage by only loading commands when needed.
 */

import { createLogger } from '@openagent/core';

const logger = createLogger('CLILoader');

/**
 * Command loader cache
 */
const commandCache = new Map<string, any>();

/**
 * Command loading statistics
 */
interface LoaderStats {
  loadedCommands: string[];
  cacheHits: number;
  cacheMisses: number;
  averageLoadTime: number;
}

const loaderStats: LoaderStats = {
  loadedCommands: [],
  cacheHits: 0,
  cacheMisses: 0,
  averageLoadTime: 0,
};

/**
 * Lazy load a command module
 */
export async function lazyLoadCommand(commandName: string): Promise<any> {
  const startTime = Date.now();
  
  // Check cache first
  if (commandCache.has(commandName)) {
    loaderStats.cacheHits++;
    logger.debug('Command loaded from cache', { commandName });
    return commandCache.get(commandName);
  }
  
  loaderStats.cacheMisses++;
  
  try {
    // Dynamic import with lazy loading
    let commandModule;
    
    switch (commandName) {
      case 'chat':
        commandModule = await import('./commands/chat');
        break;
        
      case 'run':
        commandModule = await import('./commands/run');
        break;
        
      case 'config':
        commandModule = await import('./commands/config/index');
        break;
        
      case 'config:list':
        commandModule = await import('./commands/config/list');
        break;
        
      case 'config:set':
        commandModule = await import('./commands/config/set');
        break;
        
      case 'config:get':
        commandModule = await import('./commands/config/get');
        break;
        
      case 'tool':
        commandModule = await import('./commands/tool/index');
        break;
        
      case 'tool:list':
        commandModule = await import('./commands/tool/list');
        break;
        
      case 'tool:exec':
        commandModule = await import('./commands/tool/exec');
        break;
        
      case 'provider':
        commandModule = await import('./commands/provider/index');
        break;
        
      case 'provider:list':
        commandModule = await import('./commands/provider/list');
        break;
        
      case 'provider:add':
        commandModule = await import('./commands/provider/add');
        break;
        
      case 'session':
        commandModule = await import('./commands/session/index');
        break;
        
      case 'session:list':
        commandModule = await import('./commands/session/list');
        break;
        
      case 'session:show':
        commandModule = await import('./commands/session/show');
        break;
        
      case 'help':
        // Help is built-in, no need to lazy load
        return null;
        
      default:
        logger.warn('Unknown command', { commandName });
        return null;
    }
    
    // Cache the loaded command
    commandCache.set(commandName, commandModule);
    
    const loadTime = Date.now() - startTime;
    loaderStats.loadedCommands.push(commandName);
    loaderStats.averageLoadTime = 
      (loaderStats.averageLoadTime * (loaderStats.loadedCommands.length - 1) + loadTime) /
      loaderStats.loadedCommands.length;
    
    logger.debug('Command loaded', { 
      commandName, 
      loadTime: `${loadTime}ms`,
      cached: true,
    });
    
    return commandModule;
  } catch (error) {
    logger.error('Failed to load command', error as Error, { commandName });
    throw error;
  }
}

/**
 * Preload commonly used commands
 */
export async function preloadCommonCommands(): Promise<void> {
  const commonCommands = ['chat', 'config', 'tool'];
  
  logger.info('Preloading common commands', { commands: commonCommands });
  
  await Promise.all(
    commonCommands.map(cmd => 
      lazyLoadCommand(cmd).catch(err => 
        logger.warn('Failed to preload command', { command: cmd, error: (err as Error).message })
      )
    )
  );
  
  logger.info('Common commands preloaded');
}

/**
 * Clear command cache
 */
export function clearCommandCache(): void {
  commandCache.clear();
  loaderStats.loadedCommands = [];
  loaderStats.cacheHits = 0;
  loaderStats.cacheMisses = 0;
  loaderStats.averageLoadTime = 0;
  
  logger.info('Command cache cleared');
}

/**
 * Get loader statistics
 */
export function getLoaderStats(): LoaderStats & { cacheSize: number } {
  return {
    ...loaderStats,
    cacheSize: commandCache.size,
  };
}

/**
 * Command loader hook for oclif
 * This replaces static imports with dynamic lazy loading
 */
export function createLazyCommandLoader(commandPath: string) {
  return async () => {
    const commandName = commandPath.replace(/\//g, ':').replace('/index', '');
    const module = await lazyLoadCommand(commandName);
    return module?.default;
  };
}

/**
 * Warm up loader - optionally load commands in background
 */
export function warmUpLoader(): void {
  // Preload commands after initial startup
  setTimeout(() => {
    preloadCommonCommands().catch(err => {
      logger.warn('Background preload failed', { error: (err as Error).message });
    });
  }, 1000);
}
