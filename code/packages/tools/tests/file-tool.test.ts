/**
 * Tests for File Tools
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  fileReadToolDefinition,
  fileReadHandler,
  fileWriteToolDefinition,
  fileWriteHandler,
} from '../src/builtin/file-tool';

const TEST_DIR = path.join(__dirname, 'test-files');
const TEST_FILE = path.join(TEST_DIR, 'test.txt');

describe('File Tools', () => {
  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('fileReadToolDefinition', () => {
    it('should have correct name', () => {
      expect(fileReadToolDefinition.name).toBe('file_read');
    });

    it('should have required path parameter', () => {
      expect(fileReadToolDefinition.parameters.path.required).toBe(true);
      expect(fileReadToolDefinition.parameters.path.type).toBe('string');
    });

    it('should be data category', () => {
      expect(fileReadToolDefinition.category).toBe('data');
    });
  });

  describe('fileReadHandler', () => {
    it('should read file content successfully', async () => {
      // Create test file
      await fs.writeFile(TEST_FILE, 'Hello, World!', 'utf-8');

      const result = await fileReadHandler({ path: TEST_FILE });

      expect(result.success).toBe(true);
      expect(result.data).toBe('Hello, World!');
      expect(result.metadata?.path).toBe(TEST_FILE);
    });

    it('should read file with different encodings', async () => {
      const content = 'Test content';
      await fs.writeFile(TEST_FILE, content, 'utf-8');

      const result = await fileReadHandler({ 
        path: TEST_FILE, 
        encoding: 'utf-8' 
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(content);
    });

    it('should handle file not found', async () => {
      const result = await fileReadHandler({ 
        path: path.join(TEST_DIR, 'nonexistent.txt') 
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it('should handle directory path instead of file', async () => {
      const result = await fileReadHandler({ path: TEST_DIR });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/directory/i);
    });

    it('should reject invalid parameters', async () => {
      const result = await fileReadHandler({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject path traversal attempts', async () => {
      const result = await fileReadHandler({ 
        path: '../../../etc/passwd' 
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/traversal|permission/i);
    });

    it('should include size metadata', async () => {
      const content = 'Test content for size check';
      await fs.writeFile(TEST_FILE, content, 'utf-8');

      const result = await fileReadHandler({ path: TEST_FILE });

      expect(result.success).toBe(true);
      expect(result.metadata?.size).toBe(content.length);
    });
  });

  describe('fileWriteToolDefinition', () => {
    it('should have correct name', () => {
      expect(fileWriteToolDefinition.name).toBe('file_write');
    });

    it('should have required parameters', () => {
      expect(fileWriteToolDefinition.parameters.path.required).toBe(true);
      expect(fileWriteToolDefinition.parameters.content.required).toBe(true);
    });

    it('should be action category', () => {
      expect(fileWriteToolDefinition.category).toBe('action');
    });
  });

  describe('fileWriteHandler', () => {
    it('should write file content successfully', async () => {
      const content = 'Test write content';

      const result = await fileWriteHandler({ 
        path: TEST_FILE, 
        content 
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.bytesWritten).toBe(content.length);

      // Verify content was written
      const readContent = await fs.readFile(TEST_FILE, 'utf-8');
      expect(readContent).toBe(content);
    });

    it('should create parent directories automatically', async () => {
      const nestedPath = path.join(TEST_DIR, 'nested', 'dir', 'file.txt');
      const content = 'Nested file content';

      const result = await fileWriteHandler({ 
        path: nestedPath, 
        content 
      });

      expect(result.success).toBe(true);

      // Verify file was created
      const readContent = await fs.readFile(nestedPath, 'utf-8');
      expect(readContent).toBe(content);
    });

    it('should overwrite existing file', async () => {
      const originalContent = 'Original content';
      const newContent = 'New content';

      // Write original
      await fileWriteHandler({ path: TEST_FILE, content: originalContent });

      // Overwrite
      const result = await fileWriteHandler({ 
        path: TEST_FILE, 
        content: newContent,
        mode: 'overwrite'
      });

      expect(result.success).toBe(true);

      // Verify overwrite
      const readContent = await fs.readFile(TEST_FILE, 'utf-8');
      expect(readContent).toBe(newContent);
    });

    it('should append to existing file', async () => {
      const originalContent = 'Original';
      const appendContent = ' Appended';

      // Write original
      await fileWriteHandler({ path: TEST_FILE, content: originalContent });

      // Append
      const result = await fileWriteHandler({ 
        path: TEST_FILE, 
        content: appendContent,
        mode: 'append'
      });

      expect(result.success).toBe(true);

      // Verify append
      const readContent = await fs.readFile(TEST_FILE, 'utf-8');
      expect(readContent).toBe(originalContent + appendContent);
    });

    it('should handle different encodings', async () => {
      const content = 'Encoding test';

      const result = await fileWriteHandler({ 
        path: TEST_FILE, 
        content,
        encoding: 'utf-8'
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid parameters', async () => {
      const result = await fileWriteHandler({ path: TEST_FILE });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject path traversal attempts', async () => {
      const result = await fileWriteHandler({ 
        path: '../../../tmp/malicious.txt',
        content: 'malicious'
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/traversal|permission/i);
    });

    it('should include metadata', async () => {
      const content = 'Test content';

      const result = await fileWriteHandler({ 
        path: TEST_FILE, 
        content 
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.path).toBe(TEST_FILE);
      expect(result.metadata?.size).toBe(content.length);
      expect(result.metadata?.mode).toBe('overwrite');
    });
  });
});
