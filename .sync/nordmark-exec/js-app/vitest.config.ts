import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } }, // tsconfig "@/*" for components
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'scripts/**/*.test.ts', 'components/**/*.test.{ts,tsx}'],
    testTimeout: 30_000,
  },
});
