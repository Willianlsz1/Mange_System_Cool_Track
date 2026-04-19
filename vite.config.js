import { defineConfig } from 'vite';

const ANALYZE = process.env.ANALYZE === 'true';

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
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov'],
    include: ['src/core/**', 'src/domain/**'],
  },
};

export default defineConfig(async () => ({
  base: '/',
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
