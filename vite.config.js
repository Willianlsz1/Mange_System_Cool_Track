import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Mange_System_Cool_Track/',

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
      output: {
        manualChunks: undefined,
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },

  css: {
    devSourcemap: true,
  },

  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/core/**', 'src/domain/**'],
    },
  }

});
