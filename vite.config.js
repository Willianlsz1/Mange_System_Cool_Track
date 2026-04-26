import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const ANALYZE = process.env.ANALYZE === 'true';

// Versão e commit curto injetados no build pra exibir no footer da landing/app.
// `pkg.version` vem do package.json (source of truth).
// `APP_COMMIT` é resolvido nessa ordem:
//   1. VITE_APP_COMMIT (explícito, pra casos especiais)
//   2. CF_PAGES_COMMIT_SHA (injetado pelo Cloudflare Pages — fonte real em prod)
//   3. 'dev' (fallback pra builds locais sem env var)
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const APP_VERSION = pkg.version;
const APP_COMMIT =
  process.env.VITE_APP_COMMIT ||
  (process.env.CF_PAGES_COMMIT_SHA ? process.env.CF_PAGES_COMMIT_SHA.slice(0, 7) : '') ||
  'dev';

// `rollup-plugin-visualizer` é um devDep opcional — só carregado quando
// ANALYZE=true. Mantemos o import dinâmico pra não quebrar `npm run dev`
// caso o pacote não esteja instalado (ex.: clone fresh sem o opcional).
async function buildPlugins() {
  if (!ANALYZE) return [];
  try {
    const { visualizer } = await import('rollup-plugin-visualizer');
    return [
      visualizer({
        filename: 'dist/bundle-stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap',
      }),
    ];
  } catch {
    console.warn(
      '[vite.config] ANALYZE=true mas rollup-plugin-visualizer não está instalado. ' +
        'Rode `npm i -D rollup-plugin-visualizer` pra habilitar o analyzer.',
    );
    return [];
  }
}

// manualChunks: separa vendors em chunks dedicados pra (a) cache de longa
// duração — quando você mudar 1 linha do seu código, o usuário não re-baixa
// Supabase nem Sentry; (b) paralelização do download — o browser baixa
// vários chunks em paralelo em vez de um monolito sequencial.
//
// Importante: esses chunks só são baixados quando ALGUM código os referencia.
// Se você usa lazy import em algum lugar (ex.: import('@sentry/browser')
// dentro de observability.js), o chunk vira "lazy" automaticamente.
function manualChunks(id) {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('@sentry')) return 'vendor-sentry';
  if (id.includes('@supabase') || id.includes('phoenix')) return 'vendor-supabase';
  if (
    id.includes('jspdf') ||
    id.includes('html2canvas') ||
    id.includes('canvg') ||
    id.includes('svg-pathdata') ||
    id.includes('stackblur') ||
    id.includes('rgbcolor')
  ) {
    return 'vendor-pdf';
  }
  if (id.includes('chart.js') || id.includes('@kurkle/color')) return 'vendor-charts';
  return undefined;
}

const buildOutput = {
  manualChunks,
  entryFileNames: 'assets/[name].[hash].js',
  chunkFileNames: 'assets/[name].[hash].js',
  assetFileNames: 'assets/[name].[hash].[ext]',
};

const vitestConfig = {
  globals: true,
  environment: 'jsdom',
  env: {
    VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
    VITE_SUPABASE_KEY: 'placeholder-key-for-tests',
  },
  exclude: ['e2e/**', '**/node_modules/**', '**/dist/**', '**/.{idea,git,cache,output,temp}/**'],
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov'],
    include: ['src/core/**', 'src/domain/**'],
  },
};

export default defineConfig(async () => ({
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_COMMIT__: JSON.stringify(APP_COMMIT),
  },
  server: {
    port: 5173,
    open: true,
    host: true,
  },
  plugins: await buildPlugins(),
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: buildOutput,
    },
  },
  css: {
    devSourcemap: true,
  },
  test: vitestConfig,
}));
