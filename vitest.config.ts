import { defineConfig } from 'vitest/config';

const srcAlias = decodeURIComponent(new URL('./src', import.meta.url).pathname);

export default defineConfig({
  resolve: {
    alias: {
      '@': srcAlias,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
