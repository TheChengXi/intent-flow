import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'another_extension_pi/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
