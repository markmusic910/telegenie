export default {
  eslintIntegration: true,
  printWidth: 100,
  // tabWidth: 4, // honor the editorconfig
  trailingComma: 'all',
  singleQuote: true,
  semi: true,
  importOrder: ['^@/(.*)$', '^[./]'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  plugins: ['prettier-plugin-organize-imports'],
};
