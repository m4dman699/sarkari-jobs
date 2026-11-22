import js from './frontend-tools/node_modules/@eslint/js/src/index.js';
import globals from './frontend-tools/node_modules/globals/index.js';

export default [
  {
    ignores: ['data/**', 'job-details/**', 'drafts/**', 'frontend-tools/node_modules/**']
  },
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        CATEGORIES: 'readonly',
        STATES: 'readonly',
        daysUntil: 'readonly',
        jobCardHTML: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-redeclare': 'off',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }]
    }
  }
];
