import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/', '**/dist/', 'data/', 'coverage/', 'apps/server/drizzle/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['apps/server/**/*.ts', 'packages/**/*.ts', '*.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/public/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Вставка сырого HTML — прямой путь к XSS; всё выводится через React.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML запрещён (XSS).',
        },
      ],
    },
  },
);
