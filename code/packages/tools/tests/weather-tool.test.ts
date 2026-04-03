/**
 * Tests for Weather Tool
 */

import { describe, it, expect } from 'vitest';
import {
  weatherToolDefinition,
  weatherToolHandler,
} from '../src/builtin/weather-tool';

describe('weatherToolDefinition', () => {
  it('should have correct name', () => {
    expect(weatherToolDefinition.name).toBe('weather');
  });

  it('should have required location parameter', () => {
    expect(weatherToolDefinition.parameters.location.required).toBe(true);
    expect(weatherToolDefinition.parameters.location.type).toBe('string');
  });

  it('should have optional unit parameter with enum', () => {
    expect(weatherToolDefinition.parameters.unit.required).toBeFalsy();
    expect(weatherToolDefinition.parameters.unit.enum).toEqual(['celsius', 'fahrenheit']);
    expect(weatherToolDefinition.parameters.unit.default).toBe('celsius');
  });

  it('should be utility category', () => {
    expect(weatherToolDefinition.category).toBe('utility');
  });
});

describe('weatherToolHandler', () => {
  describe('successful responses', () => {
    it('should return weather data for location', async () => {
      const result = await weatherToolHandler({ location: 'Beijing' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as any).location).toBe('Beijing');
    });

    it('should return celsius temperature by default', async () => {
      const result = await weatherToolHandler({ location: 'Tokyo' });
      
      expect(result.success).toBe(true);
      expect((result.data as any).unit).toBe('celsius');
      expect((result.data as any).temperature).toBeDefined();
    });

    it('should return fahrenheit temperature when requested', async () => {
      const result = await weatherToolHandler({ 
        location: 'New York',
        unit: 'fahrenheit',
      });
      
      expect(result.success).toBe(true);
      expect((result.data as any).unit).toBe('fahrenheit');
    });

    it('should include weather conditions', async () => {
      const result = await weatherToolHandler({ location: 'London' });
      
      expect(result.success).toBe(true);
      expect((result.data as any).conditions).toBeDefined();
      expect((result.data as any).humidity).toBeDefined();
      expect((result.data as any).windSpeed).toBeDefined();
    });

    it('should include timestamp', async () => {
      const result = await weatherToolHandler({ location: 'Paris' });
      
      expect(result.success).toBe(true);
      expect((result.data as any).lastUpdated).toBeDefined();
    });
  });

  describe('metadata', () => {
    it('should include source in metadata', async () => {
      const result = await weatherToolHandler({ location: 'Sydney' });
      
      expect(result.success).toBe(true);
      expect(result.metadata?.source).toBe('mock-api');
      expect(result.metadata?.timestamp).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should reject non-string location', async () => {
      const result = await weatherToolHandler({ location: 123 });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/location.*string/i);
    });

    it('should reject invalid unit', async () => {
      const result = await weatherToolHandler({ 
        location: 'Berlin',
        unit: 'kelvin' as any,
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/celsius.*fahrenheit|invalid.*enum/i);
    });

    it('should handle missing location gracefully', async () => {
      const result = await weatherToolHandler({});
      
      expect(result.success).toBe(false);
    });
  });

  describe('data structure', () => {
    it('should return correct weather data structure', async () => {
      const result = await weatherToolHandler({ location: 'Moscow' });
      
      expect(result.success).toBe(true);
      
      const data = result.data as any;
      expect(typeof data.location).toBe('string');
      expect(typeof data.temperature).toBe('number');
      expect(typeof data.unit).toBe('string');
      expect(typeof data.conditions).toBe('string');
      expect(typeof data.humidity).toBe('number');
      expect(typeof data.windSpeed).toBe('number');
      expect(typeof data.lastUpdated).toBe('string');
    });
  });
});
