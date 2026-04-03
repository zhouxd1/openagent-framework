import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'tests/**',
      ],
    },
    // Updated patterns to work from both monorepo root and individual package directories
    include: [
      '**/tests/**/*.test.ts',
      '**/tests/**/*.spec.ts',
      '**/__tests__/**/*.test.ts',
      '**/__tests__/**/*.spec.ts',
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
    ],
  },
});
