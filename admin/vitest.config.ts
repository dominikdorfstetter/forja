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
    alias: [
      // react-transition-group 4.x ships no `exports` map, so MUI 9.1's bare
      // subpath imports (`react-transition-group/Transition` etc.) can't be
      // resolved by Node's ESM resolver under Vitest. Point them at the real
      // ESM files. Must precede the path aliases below.
      {
        find: /^react-transition-group\/((?!cjs|esm).+)$/,
        replacement: path.resolve(__dirname, 'node_modules/react-transition-group/esm/$1.js'),
      },
      { find: '@components', replacement: path.resolve(__dirname, './src/components') },
      { find: '@pages', replacement: path.resolve(__dirname, './src/pages') },
      { find: '@services', replacement: path.resolve(__dirname, './src/services') },
      { find: '@utils', replacement: path.resolve(__dirname, './src/utils') },
      { find: '@types', replacement: path.resolve(__dirname, './src/types') },
      { find: '@hooks', replacement: path.resolve(__dirname, './src/hooks') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
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
    server: {
      deps: {
        // Route all @mui/* and react-transition-group through Vite's pipeline
        // (not Node's ESM externalizer) so the resolve.alias above can fix
        // MUI 9.1's bare react-transition-group subpath imports.
        inline: [/@mui[\\/]/, /react-transition-group/],
      },
    },
  },
});
