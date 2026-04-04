# Atualizar vite.config.js
@"
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
    minify: 'esbuild',  // ✅ MUDADO: 'terser' → 'esbuild'
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
"@ | Out-File -FilePath "vite.config.js" -Encoding utf8

Write-Host "✅ vite.config.js atualizado para esbuild!" -ForegroundColor Green