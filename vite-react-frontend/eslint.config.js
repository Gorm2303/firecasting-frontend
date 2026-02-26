import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'docs/**',
      // Generated at container start (runtime config injection)
      'public/env.js',
      // Keep build tooling scripts out of the app lint surface.
      'scripts/**',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // This codebase intentionally uses `any` in a few boundary layers (API, forms, tests).
      // Keeping this as an error creates thousands of noisy violations that drown out real issues.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Basic JS linting for config/util scripts that are still in the repo.
    // (TS rules are scoped to TS/TSX above.)
    extends: [js.configs.recommended],
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
)
