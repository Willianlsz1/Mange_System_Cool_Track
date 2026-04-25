import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

const baseGlobals = {
  ...globals.browser,
  ...globals.node,
  // Constantes injetadas em build-time pelo Vite (define em vite.config.js).
  // Exibidas no footer da landing (v1.0.0 - abc123).
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
      // dist.stale.* e criado como escape hatch quando o sandbox nao consegue
      // executar rm no dist/ pra refazer o build - o antigo e renomeado com
      // timestamp. Nao e codigo-fonte, nunca deve ser linted.
      'dist.stale*/**',
      'coverage/**',
      // Vite gera arquivos vite.config.js.timestamp-*.mjs durante dev/build.
      // Sao cache transitorio (nao versionados) e quebravam npm run lint.
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

  // Refactor Phase 0 -- Architectural layering guardrails.
  // Regras como WARNING (nao error) para permitir baseline atual passar.
  // Build nao quebra, mas violacoes aparecem em "npm run lint" e bloqueiam
  // PRs em review consciente. Quando todas as violacoes abaixo forem
  // resolvidas, promover para "error".
  //
  // Violacoes conhecidas (allowlist por documentacao, nao por config):
  //   Layer 1 -- core/domain importando de ui (3):
  //     - src/core/router.js:10  SignatureModal
  //     - src/core/router.js:11  SignatureViewerModal
  //     - src/domain/pdf.js:14   resolveSignatureForRecord
  //   Layer 2 -- view importando de view sibling (2):
  //     - src/ui/views/equipamentos.js:13  updateHeader, getHealthClass
  //     - src/ui/views/historico.js:27     updateHeader
  //   Layer 3 -- components importando de views (reverse) (1):
  //     - src/ui/components/nameplateCapture.js:36
  // Plano de remediacao: docs/audits/.

  // Layer 1: core/ e domain/ NAO podem importar de ui/.
  {
    files: ['src/core/**/*.js', 'src/domain/**/*.js'],
    ignores: ['src/**/__tests__/**', 'src/**/*.test.js'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['**/ui/**', '../ui/**', '../../ui/**', '../../../ui/**', 'src/ui/**'],
              message:
                'core/ e domain/ nao podem importar de ui/. Mover logica compartilhada para domain/ ou core/, ou inverter dependencia via callback/registry. Ver docs/audits/product-review.md.',
            },
          ],
        },
      ],
    },
  },

  // Layer 2: views top-level NAO podem importar de outras views top-level.
  // Aplica APENAS a src/ui/views/*.js (sem **) -- imports dentro do mesmo
  // subfolder de feature (ex: equipamentos/setores.js -> ./constants.js)
  // sao permitidos e legitimos.
  {
    files: ['src/ui/views/*.js'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['./*.js'],
              message:
                'Views top-level nao podem importar de outras views top-level. Promover logica compartilhada (ex: updateHeader, getHealthClass) para ui/composables/ ou ui/shell/. Ver docs/audits/product-review.md.',
            },
          ],
        },
      ],
    },
  },

  // Layer 3: components NAO podem importar de views (camada reversa).
  {
    files: ['src/ui/components/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['**/views/**', '../views/**', '../../views/**', 'src/ui/views/**'],
              message:
                'Components nao podem importar de views (camada reversa quebra ao reorganizar views). Mover dependencia compartilhada para core/, domain/ ou ui/composables/. Ver docs/audits/product-review.md.',
            },
          ],
        },
      ],
    },
  },

  eslintConfigPrettier,
];
