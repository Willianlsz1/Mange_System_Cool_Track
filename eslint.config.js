import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

const baseGlobals = {
  ...globals.browser,
  ...globals.node,
  // Constantes injetadas em build-time pelo Vite (define em vite.config.js).
  // Exibidas no footer da landing (v1.0.0 · abc123).
  __APP_VERSION__: 'readonly',
  __APP_COMMIT__: 'readonly',
};

const testGlobals = {
  ...baseGlobals,
  vi: 'readonly',
  describe: 'readonly',
  it: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
};

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-*/**',
      // `dist.stale.*` é criado como escape hatch quando o sandbox não consegue
      // executar `rm` no dist/ pra refazer o build — o antigo é renomeado com
      // timestamp. Não é código-fonte, nunca deve ser linted.
      'dist.stale*/**',
      'coverage/**',
      // Vite gera arquivos `vite.config.js.timestamp-*.mjs` durante dev/build.
      // São cache transitório (não versionados) e quebravam `npm run lint`.
      'vite.config.js.timestamp-*.mjs',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: baseGlobals,
    },
    rules: {
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['src/**/*.test.js', 'src/**/__tests__/**/*.js'],
    languageOptions: {
      globals: testGlobals,
    },
  },
  eslintConfigPrettier,
];
