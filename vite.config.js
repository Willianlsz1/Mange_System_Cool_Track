import { defineConfig } from 'vite';

export default defineConfig({
  // Troque 'cooltrack' pelo nome exato do seu repositório no GitHub
  base: 'https://willianlsz1.github.io/Mange_System_Cool_Track/',

  server: {
    port: 5173,
    open: true,
    host: true,
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },

  css: {
    devSourcemap: true,
  },
});