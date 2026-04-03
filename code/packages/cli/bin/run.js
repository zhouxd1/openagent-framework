#!/usr/bin/env node

// Entry point for @openagent/cli

const path = require('path');
const fs = require('fs');

// Set up module paths
const projectBaseDir = path.join(__dirname, '..');
const distDir = path.join(projectBaseDir, 'dist');

// Check if dist exists
if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory not found. Please run "npm run build" first.');
  process.exit(1);
}

// Load and run Oclif CLI
const { run, Errors } = require('@oclif/core');

run().catch(Errors.handle);
