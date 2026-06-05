/**
 * Post-build script: generates dist/define-all.js
 *
 * This barrel import file registers all custom elements when imported.
 * Use `import '@forjacms/sections/define'` instead of the lazy loader
 * when bundling with Vite, Webpack, or Rollup.
 */
import { readdirSync, writeFileSync } from 'node:fs';

const components = readdirSync('dist/components')
  .filter(f => f.startsWith('forja-') && f.endsWith('.js'))
  .sort();

const lines = components.map(f => `import './components/${f}';`);
lines.push('');

writeFileSync('dist/define-all.js', lines.join('\n'));
writeFileSync('dist/define-all.d.ts', '// Side-effect import — registers all custom elements\nexport {};\n');

console.log(`[define-all] Generated dist/define-all.js + .d.ts (${components.length} components)`);
