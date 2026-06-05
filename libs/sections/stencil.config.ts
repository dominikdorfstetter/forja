import { Config } from '@stencil/core';
import { reactOutputTarget } from '@stencil/react-output-target';

export const config: Config = {
  namespace: 'forja-sections',
  taskQueue: 'async',
  outputTargets: [
    {
      type: 'dist-custom-elements',
      customElementsExportBehavior: 'auto-define-custom-elements',
      externalRuntime: false,
    },
    {
      type: 'dist',
      esmLoaderPath: '../loader',
    },
    reactOutputTarget({
      outDir: '../sections-react/src',
    }),
  ],
  testing: {
    browserHeadless: 'shell',
  },
};
