import { defineVitestConfig } from '@stencil/vitest/config';

// Stencil compiles JSX with the classic `h` factory. @stencil/vitest injects
// this oxc config at the ROOT level only, but Vite 8.1+ no longer inherits
// root `oxc` into Vitest sub-projects — without the per-project repeat every
// spec render fails with "The tag name provided (undefined) is not a valid
// name". Remove once @stencil/vitest applies it per project upstream.
const stencilJsx = {
  jsx: { runtime: 'classic', pragma: 'h', pragmaFrag: 'Fragment' },
} as const;

export default defineVitestConfig({
  stencilConfig: './stencil.config.ts',
  test: {
    projects: [
      {
        oxc: stencilJsx,
        test: {
          name: 'unit',
          include: ['src/**/*.unit.{ts,tsx}'],
          environment: 'node',
        },
      },
      {
        oxc: stencilJsx,
        test: {
          name: 'spec',
          include: ['src/**/*.spec.{ts,tsx}'],
          environment: 'stencil',
          setupFiles: ['./vitest-setup.ts'],
        },
      },
    ],
  },
});
