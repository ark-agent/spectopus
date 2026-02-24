import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      'spectopus': '/home/agent/repos/spectopus/src/index.ts',
      'spectopus/llm': '/home/agent/repos/spectopus/src/llm/index.ts',
      'spectopus/decorators': '/home/agent/repos/spectopus/src/decorators/index.ts',
      'spectopus/adapters/zod': '/home/agent/repos/spectopus/src/adapters/zod.ts',
    },
  },
});
