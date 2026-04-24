import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const ANALYZE = process.env.ANALYZE === 'true';

// Versão e commit curto injetados no build pra exibir no footer da landing/app.
// `pkg.version` vem do package.json (source of truth). `VITE_APP_COMMIT` vem
// do workflow GitHub Actions (step `git rev-parse --short HEAD`); fallback
// 'dev' em builds locais onde a env var não está setada.
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const APP_VERSION = pkg.version;
const APP_COMMIT = process.env.VITE_APP_COMMIT || 'dev';

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

const buildOutput = {
  manualChunks: undefined,
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
