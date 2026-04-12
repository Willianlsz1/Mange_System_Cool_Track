import { defineConfig } from 'vite';

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

export default defineConfig({
  base: '/',
  server: {
    port: 5173,
    open: true,
    host: true,
  },
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
});
