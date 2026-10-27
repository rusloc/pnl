import { defineConfig } from 'vitest/config';

// Handler tests run on recorded provider responses (test/recorded/*.json); no network.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    passWithNoTests: false,
  },
});
