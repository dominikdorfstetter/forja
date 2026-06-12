import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import { fixupPluginRules } from '@eslint/compat';
import globals from 'globals';
import requireReadOnlyGate from './eslint-rules/require-read-only-gate.js';

const forjaPlugin = {
  rules: {
    'require-read-only-gate': requireReadOnlyGate,
  },
};

const noInlineQueryKeyArrays = {
  selector: 'Property[key.name="queryKey"] > ArrayExpression',
  message:
    'Use queryKeys factory from @/lib/queryKeys — inline queryKey arrays are forbidden (issue #18)',
};

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      react: fixupPluginRules(reactPlugin),
      'react-hooks': fixupPluginRules(reactHooksPlugin),
      forja: forjaPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      // React Compiler rules — disable until Compiler is adopted
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'forja/require-read-only-gate': 'error',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      'forja/require-read-only-gate': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/__tests__/**', 'src/**/*.test.{ts,tsx}', 'src/lib/queryKeys.ts'],
    rules: {
      'no-restricted-syntax': ['error', noInlineQueryKeyArrays],
    },
  },
  {
    files: ['src/components/editor/**/*.{ts,tsx}'],
    ignores: ['src/components/editor/**/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        noInlineQueryKeyArrays,
        {
          selector:
            "CallExpression[callee.object.name='window'][callee.property.name='dispatchEvent']",
          message:
            'No window.dispatchEvent inside the editor module — coordinate peers via the SlashCommands extension options or an explicit prop.',
        },
        {
          selector:
            "CallExpression[callee.object.name='window'][callee.property.name='addEventListener']",
          message:
            'No window.addEventListener inside the editor module — coordinate peers via the SlashCommands extension options or an explicit prop.',
        },
      ],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'coverage/'],
  },
);
