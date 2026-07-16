import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Unit tests. `npm run test:e2e` (Playwright) still covers full journeys against a live backend.
 *
 * Added for the org switcher: it reconciles a persisted selection against the server's list and
 * clears the entire query cache on change, and neither is verifiable by `next build`.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
