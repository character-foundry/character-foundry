import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      // Allow unused vars prefixed with _ (warn for now, fix incrementally)
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Allow explicit any (library code dealing with unknown formats)
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow empty functions (common in tests/stubs)
      '@typescript-eslint/no-empty-function': 'off',
      // Prefer const
      'prefer-const': 'error',
      // No console in production code
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Test files can use console
    files: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // CLI can use console
    files: ['packages/cli/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      'scripts/**',
    ],
  }
);
