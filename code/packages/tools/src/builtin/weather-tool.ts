/**
 * Example Tool: Weather Information
 */

import { 
  ToolDefinition, 
  ToolExecutionResult, 
  ToolExecutionContext,
  Parameters,
  JSONObject,
  Validator,
} from '@openagent/core';
import { z } from 'zod';

/**
 * Weather tool parameter schema
 */
export const weatherSchema = z.object({
  location: z.string()
    .min(1, 'Location cannot be empty')
    .max(100, 'Location name too long (max 100 characters)'),
  unit: z.enum(['celsius', 'fahrenheit']).optional().default('celsius'),
});

export type WeatherParams = z.infer<typeof weatherSchema>;

export const weatherToolDefinition: ToolDefinition = {
  name: 'weather',
  description: 'Get current weather information for a location',
  category: 'utility',
  parameters: {
    location: {
      type: 'string',
      description: 'City or location name',
      required: true,
    },
    unit: {
      type: 'string',
      description: 'Temperature unit',
      required: false,
      enum: ['celsius', 'fahrenheit'],
      default: 'celsius',
    },
  },
  returns: {
    type: 'object',
    description: 'Weather information including temperature and conditions',
  },
};

/**
 * Weather data interface
 */
interface WeatherData extends JSONObject {
  location: string;
  temperature: number;
  unit: string;
  conditions: string;
  humidity: number;
  windSpeed: number;
  lastUpdated: string;
}

export async function weatherToolHandler(
  parameters: Parameters,
  _context?: ToolExecutionContext
): Promise<ToolExecutionResult> {
  try {
    // Validate parameters
    const validation = Validator.safeValidate(weatherSchema, parameters);
    
    if (!validation.success) {
      const errorMessage = validation.errors?.map(e => `${e.path}: ${e.message}`).join('; ') || 'Validation failed';
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { location, unit = 'celsius' } = validation.data!;

    // Mock weather data for demonstration
    // In production, this would call a real weather API
    const mockWeather: WeatherData = {
      location,
      temperature: unit === 'celsius' ? 22 : 72,
      unit,
      conditions: 'Partly cloudy',
      humidity: 65,
      windSpeed: 10,
      lastUpdated: new Date().toISOString(),
    };

    return {
      success: true,
      data: mockWeather,
      metadata: {
        source: 'mock-api',
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
