/**
 * Init Hook
 * 
 * Runs before any command to initialize the CLI environment.
 */

import { Hook } from '@oclif/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const hook: Hook<'init'> = async function (options) {
  // Ensure config directory exists
  const configDir = path.join(os.homedir(), '.openagent');
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Set default configuration file if it doesn't exist
  const configPath = path.join(configDir, 'config.json');
  
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      defaultProvider: 'openai',
      defaultModel: 'gpt-4',
      tools: {
        enabled: [],
        disabled: [],
      },
      output: {
        format: 'text',
        color: true,
      },
      history: {
        enabled: true,
        maxSize: 1000,
      },
    };
    
    fs.writeFileSync(
      configPath,
      JSON.stringify(defaultConfig, null, 2),
      'utf-8'
    );
  }
};

export default hook;
