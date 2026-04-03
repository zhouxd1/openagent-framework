import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Logger } from '../src/logging/logger';
import { LogLevelUtils } from '../src/logging/level';
import { ConsoleTransport, MemoryTransport } from '../src/logging/transport';
import { JsonFormatter, TextFormatter } from '../src/logging/formatter';

describe('Logger', () => {
  let logger: Logger;
  let memoryTransport: MemoryTransport;

  beforeEach(() => {
    memoryTransport = new MemoryTransport();
    logger = new Logger({
      name: 'test-logger',
      level: 'debug',
      transports: [memoryTransport],
    });
  });

  describe('log levels', () => {
    test('should log debug message', () => {
      logger.debug('Debug message');
      const entries = memoryTransport.getByLevel('debug');
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Debug message');
    });

    test('should log info message', () => {
      logger.info('Info message');
      const entries = memoryTransport.getByLevel('info');
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Info message');
    });

    test('should log warn message', () => {
      logger.warn('Warn message');
      const entries = memoryTransport.getByLevel('warn');
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Warn message');
    });

    test('should log error message', () => {
      logger.error('Error message');
      const entries = memoryTransport.getByLevel('error');
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Error message');
    });
  });

  describe('log filtering', () => {
    test('should respect log level', () => {
      const warnLogger = new Logger({
        name: 'warn-logger',
        level: 'warn',
        transports: [memoryTransport],
      });

      warnLogger.debug('Should not log');
      expect(memoryTransport.getByLevel('debug')).toHaveLength(0);

      warnLogger.info('Should not log');
      expect(memoryTransport.getByLevel('info')).toHaveLength(0);

      warnLogger.warn('Should log');
      expect(memoryTransport.getByLevel('warn')).toHaveLength(1);

      warnLogger.error('Should log');
      expect(memoryTransport.getByLevel('error')).toHaveLength(1);
    });
  });

  describe('metadata', () => {
    test('should include metadata in log entry', () => {
      logger.info('Test message', { userId: '123', action: 'login' });

      const entries = memoryTransport.getEntries();
      expect(entries[0].userId).toBe('123');
      expect(entries[0].action).toBe('login');
    });

    test('should include context in all entries', () => {
      const contextLogger = new Logger({
        name: 'context-logger',
        level: 'info',
        transports: [memoryTransport],
        context: { service: 'api', version: '1.0' },
      });

      contextLogger.info('Message 1');
      contextLogger.info('Message 2');

      const entries = memoryTransport.getEntries();
      expect(entries[0].service).toBe('api');
      expect(entries[0].version).toBe('1.0');
      expect(entries[1].service).toBe('api');
      expect(entries[1].version).toBe('1.0');
    });
  });

  describe('child logger', () => {
    test('should create child with additional context', () => {
      const childLogger = logger.child({ requestId: 'abc123' });

      childLogger.info('Child message');

      const entries = memoryTransport.getEntries();
      expect(entries[0].requestId).toBe('abc123');
    });

    test('should preserve parent context', () => {
      const parentLogger = new Logger({
        name: 'parent',
        level: 'info',
        transports: [memoryTransport],
        context: { service: 'api' },
      });

      const childLogger = parentLogger.child({ requestId: 'req1' });
      childLogger.info('Child message');

      const entries = memoryTransport.getEntries();
      expect(entries[0].service).toBe('api');
      expect(entries[0].requestId).toBe('req1');
    });
  });

  describe('withContext', () => {
    test('should create logger with single context value', () => {
      const contextLogger = logger.withContext('userId', 'user123');

      contextLogger.info('Message');

      const entries = memoryTransport.getEntries();
      expect(entries[0].userId).toBe('user123');
    });
  });

  describe('time tracking', () => {
    test('should log duration for async function', async () => {
      await logger.time('info', 'Operation', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'result';
      });

      const entries = memoryTransport.getEntries();
      expect(entries[0].message).toBe('Operation');
      expect(entries[0].duration).toBeDefined();
      expect(entries[0].duration).toMatch(/\d+ms/);
    });

    test('should log duration even on error', async () => {
      await expect(
        logger.time('error', 'Failing operation', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      const entries = memoryTransport.getEntries();
      expect(entries[0].duration).toBeDefined();
      expect(entries[0].error).toBe('Test error');
    });
  });

  describe('transport management', () => {
    test('should add transport', () => {
      const newTransport = new MemoryTransport();
      logger.addTransport(newTransport);

      logger.info('Message');

      expect(memoryTransport.getEntries()).toHaveLength(1);
      expect(newTransport.getEntries()).toHaveLength(1);
    });

    test('should remove transport', () => {
      logger.removeTransport(memoryTransport);

      logger.info('Message');

      expect(memoryTransport.getEntries()).toHaveLength(0);
    });
  });

  describe('setLevel', () => {
    test('should change log level', () => {
      logger.setLevel('error');

      logger.info('Should not log');
      expect(memoryTransport.getEntries()).toHaveLength(0);

      logger.error('Should log');
      expect(memoryTransport.getEntries()).toHaveLength(1);
    });
  });

  describe('context management', () => {
    test('should set context', () => {
      logger.setContext({ service: 'test' });
      logger.info('Message');

      const entries = memoryTransport.getEntries();
      expect(entries[0].service).toBe('test');
    });

    test('should add to context', () => {
      logger.setContext({ service: 'test' });
      logger.addContext({ version: '1.0' });
      logger.info('Message');

      const entries = memoryTransport.getEntries();
      expect(entries[0].service).toBe('test');
      expect(entries[0].version).toBe('1.0');
    });

    test('should clear context', () => {
      logger.setContext({ service: 'test' });
      logger.clearContext();
      logger.info('Message');

      const entries = memoryTransport.getEntries();
      expect(entries[0].service).toBeUndefined();
    });
  });
});

describe('LogLevelUtils', () => {
  test('should check if level should log', () => {
    expect(LogLevelUtils.shouldLog('error', 'debug')).toBe(true);
    expect(LogLevelUtils.shouldLog('debug', 'error')).toBe(false);
    expect(LogLevelUtils.shouldLog('warn', 'warn')).toBe(true);
  });

  test('should get level value', () => {
    expect(LogLevelUtils.getLevelValue('debug')).toBe(0);
    expect(LogLevelUtils.getLevelValue('info')).toBe(1);
    expect(LogLevelUtils.getLevelValue('warn')).toBe(2);
    expect(LogLevelUtils.getLevelValue('error')).toBe(3);
  });

  test('should parse level string', () => {
    expect(LogLevelUtils.parseLevel('DEBUG')).toBe('debug');
    expect(LogLevelUtils.parseLevel('Info')).toBe('info');
    expect(LogLevelUtils.parseLevel('WARN')).toBe('warn');
    expect(LogLevelUtils.parseLevel('invalid')).toBeUndefined();
  });

  test('should compare levels', () => {
    expect(LogLevelUtils.compare('debug', 'info')).toBeLessThan(0);
    expect(LogLevelUtils.compare('error', 'warn')).toBeGreaterThan(0);
    expect(LogLevelUtils.compare('info', 'info')).toBe(0);
  });

  test('should get all levels', () => {
    const levels = LogLevelUtils.getAllLevels();
    expect(levels).toEqual(['debug', 'info', 'warn', 'error']);
  });
});

describe('MemoryTransport', () => {
  let transport: MemoryTransport;

  beforeEach(() => {
    transport = new MemoryTransport();
  });

  test('should store entries', () => {
    transport.log({
      timestamp: new Date(),
      level: 'info',
      logger: 'test',
      message: 'Test message',
    });

    expect(transport.getEntries()).toHaveLength(1);
  });

  test('should filter by level', () => {
    transport.log({
      timestamp: new Date(),
      level: 'info',
      logger: 'test',
      message: 'Info message',
    });
    transport.log({
      timestamp: new Date(),
      level: 'error',
      logger: 'test',
      message: 'Error message',
    });

    expect(transport.getByLevel('info')).toHaveLength(1);
    expect(transport.getByLevel('error')).toHaveLength(1);
    expect(transport.getByLevel('warn')).toHaveLength(0);
  });

  test('should search messages', () => {
    transport.log({
      timestamp: new Date(),
      level: 'info',
      logger: 'test',
      message: 'User login successful',
    });
    transport.log({
      timestamp: new Date(),
      level: 'info',
      logger: 'test',
      message: 'User logout',
    });

    const results = transport.search('login');
    expect(results).toHaveLength(1);
    expect(results[0].message).toBe('User login successful');
  });

  test('should respect max size', () => {
    const smallTransport = new MemoryTransport({ maxSize: 3 });

    for (let i = 0; i < 5; i++) {
      smallTransport.log({
        timestamp: new Date(),
        level: 'info',
        logger: 'test',
        message: `Message ${i}`,
      });
    }

    expect(smallTransport.getEntries()).toHaveLength(3);
    expect(smallTransport.getEntries()[0].message).toBe('Message 2');
  });

  test('should clear entries', () => {
    transport.log({
      timestamp: new Date(),
      level: 'info',
      logger: 'test',
      message: 'Message',
    });

    transport.clear();
    expect(transport.getEntries()).toHaveLength(0);
  });
});

describe('Formatters', () => {
  const entry = {
    timestamp: new Date('2024-01-01T12:00:00.000Z'),
    level: 'info' as const,
    logger: 'test',
    message: 'Test message',
    userId: '123',
  };

  test('JsonFormatter should format as JSON', () => {
    const formatter = new JsonFormatter();
    const output = formatter.format(entry);

    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed.message).toBe('Test message');
    expect(parsed.userId).toBe('123');
  });

  test('TextFormatter should format as text', () => {
    const formatter = new TextFormatter();
    const output = formatter.format(entry);

    expect(output).toContain('2024-01-01T12:00:00.000Z');
    expect(output).toContain('INFO');
    expect(output).toContain('[test]');
    expect(output).toContain('Test message');
    expect(output).toContain('userId=123');
  });

  test('TextFormatter should support colorization', () => {
    const formatter = new TextFormatter({ colorize: true });
    const output = formatter.format(entry);

    // Should contain ANSI color codes
    expect(output).toContain('\x1b[');
  });
});

describe('ConsoleTransport', () => {
  test('should log to console', () => {
    const consoleSpy = vi.spyOn(console, 'log');

    const transport = new ConsoleTransport();
    transport.log({
      timestamp: new Date(),
      level: 'info',
      logger: 'test',
      message: 'Test message',
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should use console.error for errors', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');

    const transport = new ConsoleTransport();
    transport.log({
      timestamp: new Date(),
      level: 'error',
      logger: 'test',
      message: 'Error message',
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
