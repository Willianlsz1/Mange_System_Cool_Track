import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

const baseGlobals = {
  ...globals.browser,
  ...globals.node,
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
