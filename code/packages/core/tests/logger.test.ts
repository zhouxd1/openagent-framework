import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger, LogLevel, ConsoleTransport } from '../src/logger';

describe('Logger', () => {
  let logger: Logger;
  let consoleSpy: any;

  beforeEach(() => {
    logger = new Logger({ level: LogLevel.DEBUG });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('log levels', () => {
    it('should log debug messages', () => {
      logger.debug('test message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log info messages', () => {
      logger.info('test message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      logger.warn('test message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      logger.error('test message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should respect log level', () => {
      const warnLogger = new Logger({ level: LogLevel.WARN });
      
      warnLogger.debug('debug message');
      expect(consoleSpy).not.toHaveBeenCalled();
      
      warnLogger.warn('warn message');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('context', () => {
    it('should include context in log', () => {
      logger.info('test message', { key: 'value' });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('key')
      );
    });

    it('should support child loggers with default context', () => {
      const childLogger = logger.child({ component: 'test' });
      childLogger.info('child message');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('component')
      );
    });
  });

  describe('error logging', () => {
    it('should log error with stack trace', () => {
      const error = new Error('test error');
      logger.error('operation failed', error);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error: test error')
      );
    });
  });

  describe('timing', () => {
    it('should time synchronous operations', async () => {
      await logger.time('operation', () => 'result');
      expect(consoleSpy).toHaveBeenCalledTimes(2); // start + complete
    });

    it('should time async operations', async () => {
      await logger.time('async operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      });
      expect(consoleSpy).toHaveBeenCalledTimes(2);
    });

    it('should log errors during timed operations', async () => {
      await expect(
        logger.time('failing operation', () => {
          throw new Error('operation failed');
        })
      ).rejects.toThrow();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('failed')
      );
    });
  });
});

describe('ConsoleTransport', () => {
  it('should format log entry', () => {
    const transport = new ConsoleTransport(false);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    transport.log({
      level: LogLevel.INFO,
      message: 'test message',
      timestamp: new Date('2024-01-01T00:00:00Z'),
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('test message')
    );

    consoleSpy.mockRestore();
  });

  it('should redact sensitive fields', () => {
    const transport = new ConsoleTransport(false);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    transport.log({
      level: LogLevel.INFO,
      message: 'test message',
      context: {
        apiKey: 'secret-key',
        publicData: 'visible',
      },
      timestamp: new Date(),
    });

    const loggedMessage = consoleSpy.mock.calls[0][0];
    expect(loggedMessage).toContain('***REDACTED***');
    expect(loggedMessage).not.toContain('secret-key');

    consoleSpy.mockRestore();
  });
});
