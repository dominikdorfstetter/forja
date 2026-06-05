/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Mirror the build-time global from vite.config.ts so components that print
  // the app version (e.g. the Welcome footer) render under test.
  define: {
    __APP_VERSION__: JSON.stringify('test'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    pool: 'threads',
    threads: {
      execArgv: ['--max-old-space-size=4096'],
      // Threads share module cache across the pool, so MUI + Tiptap + React
      // are transformed once instead of 75 times. That cut the cold-import
      // tail beforeAll pain that fork-mode kept hitting after the MUI v9
      // bundle-size bump. Cap at 4 threads — enough parallelism for the
      // box, few enough that per-thread memory stays under the 4 GB ceiling.
      maxThreads: 4,
      minThreads: 1,
    },
    testTimeout: 30000,
    hookTimeout: 60000,
    deps: {
      optimizer: {
        web: {
          include: ['@mui/x-date-pickers'],
        },
      },
    },
  },
});
