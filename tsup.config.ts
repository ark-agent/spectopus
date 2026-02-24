import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'llm/index': 'src/llm/index.ts',
    'decorators/index': 'src/decorators/index.ts',
    'adapters/zod': 'src/adapters/zod.ts',
    'adapters/joi': 'src/adapters/joi.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  target: 'es2022',
  outDir: 'dist',
});
