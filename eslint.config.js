import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      '.next',
      'apps/**/node_modules',
      'packages/**/node_modules',
      'apps/**/.next',
      'packages/teleproto/**',
      'apps/web/public',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn'
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@telegenie/sdk/*', '@telegenie/sdk/**'],
              message: 'Import @telegenie/sdk only. Store writes go through controllers.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='setSelectedFolderId']",
          message: 'Use sdk.dialogFilter.selectFolder instead of nav.setSelectedFolderId.',
        },
        {
          selector: "CallExpression[callee.property.name='setHistoryState']",
          message: 'History flags are owned by MessageController.',
        },
        {
          selector: "CallExpression[callee.property.name='resetThreadHistoryState']",
          message: 'Use sdk.message.openDialog instead of resetThreadHistoryState.',
        },
        {
          selector: "CallExpression[callee.property.name='getOrCreateDialogUI']",
          message: 'Read getDialogUI / useGlobalStoreDialog instead of getOrCreateDialogUI.',
        },
        {
          selector: "CallExpression[callee.property.name='getOrCreateThreadUI']",
          message: 'Read getThreadUI / useGlobalStoreThread instead of getOrCreateThreadUI.',
        },
        {
          selector: "CallExpression[callee.property.name='ensureMessageStore']",
          message: 'Use sdk.getMessageStore for reads. Controllers own ensureMessageStore.',
        },
        {
          selector: "CallExpression[callee.property.name='deleteByIds']",
          message: 'Entity deletes go through SDK controllers.',
        },
        {
          selector: "CallExpression[callee.property.name='hydrate']",
          message: 'Entity hydrate is SDK-internal.',
        },
      ],
    },
  },
);
