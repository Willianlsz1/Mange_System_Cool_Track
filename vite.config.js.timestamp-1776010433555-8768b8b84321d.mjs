// vite.config.js
import { defineConfig } from 'file:///sessions/keen-friendly-wozniak/mnt/willianlsz1-mange_system_cool_track/node_modules/vite/dist/node/index.js';
var buildOutput = {
  manualChunks: void 0,
  entryFileNames: 'assets/[name].[hash].js',
  chunkFileNames: 'assets/[name].[hash].js',
  assetFileNames: 'assets/[name].[hash].[ext]',
};
var vitestConfig = {
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
var vite_config_default = defineConfig({
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
export { vite_config_default as default };
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMva2Vlbi1mcmllbmRseS13b3puaWFrL21udC93aWxsaWFubHN6MS1tYW5nZV9zeXN0ZW1fY29vbF90cmFja1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2tlZW4tZnJpZW5kbHktd296bmlhay9tbnQvd2lsbGlhbmxzejEtbWFuZ2Vfc3lzdGVtX2Nvb2xfdHJhY2svdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL2tlZW4tZnJpZW5kbHktd296bmlhay9tbnQvd2lsbGlhbmxzejEtbWFuZ2Vfc3lzdGVtX2Nvb2xfdHJhY2svdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcblxuY29uc3QgYnVpbGRPdXRwdXQgPSB7XG4gIG1hbnVhbENodW5rczogdW5kZWZpbmVkLFxuICBlbnRyeUZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV0uW2hhc2hdLmpzJyxcbiAgY2h1bmtGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLltoYXNoXS5qcycsXG4gIGFzc2V0RmlsZU5hbWVzOiAnYXNzZXRzL1tuYW1lXS5baGFzaF0uW2V4dF0nLFxufTtcblxuY29uc3Qgdml0ZXN0Q29uZmlnID0ge1xuICBnbG9iYWxzOiB0cnVlLFxuICBlbnZpcm9ubWVudDogJ2pzZG9tJyxcbiAgZW52OiB7XG4gICAgVklURV9TVVBBQkFTRV9VUkw6ICdodHRwczovL3BsYWNlaG9sZGVyLnN1cGFiYXNlLmNvJyxcbiAgICBWSVRFX1NVUEFCQVNFX0tFWTogJ3BsYWNlaG9sZGVyLWtleS1mb3ItdGVzdHMnLFxuICB9LFxuICBjb3ZlcmFnZToge1xuICAgIHByb3ZpZGVyOiAndjgnLFxuICAgIHJlcG9ydGVyOiBbJ3RleHQnLCAnbGNvdiddLFxuICAgIGluY2x1ZGU6IFsnc3JjL2NvcmUvKionLCAnc3JjL2RvbWFpbi8qKiddLFxuICB9LFxufTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgYmFzZTogJy8nLFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiA1MTczLFxuICAgIG9wZW46IHRydWUsXG4gICAgaG9zdDogdHJ1ZSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICBhc3NldHNEaXI6ICdhc3NldHMnLFxuICAgIHNvdXJjZW1hcDogZmFsc2UsXG4gICAgbWluaWZ5OiAnZXNidWlsZCcsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiBidWlsZE91dHB1dCxcbiAgICB9LFxuICB9LFxuICBjc3M6IHtcbiAgICBkZXZTb3VyY2VtYXA6IHRydWUsXG4gIH0sXG4gIHRlc3Q6IHZpdGVzdENvbmZpZyxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF1WSxTQUFTLG9CQUFvQjtBQUVwYSxJQUFNLGNBQWM7QUFBQSxFQUNsQixjQUFjO0FBQUEsRUFDZCxnQkFBZ0I7QUFBQSxFQUNoQixnQkFBZ0I7QUFBQSxFQUNoQixnQkFBZ0I7QUFDbEI7QUFFQSxJQUFNLGVBQWU7QUFBQSxFQUNuQixTQUFTO0FBQUEsRUFDVCxhQUFhO0FBQUEsRUFDYixLQUFLO0FBQUEsSUFDSCxtQkFBbUI7QUFBQSxJQUNuQixtQkFBbUI7QUFBQSxFQUNyQjtBQUFBLEVBQ0EsVUFBVTtBQUFBLElBQ1IsVUFBVTtBQUFBLElBQ1YsVUFBVSxDQUFDLFFBQVEsTUFBTTtBQUFBLElBQ3pCLFNBQVMsQ0FBQyxlQUFlLGVBQWU7QUFBQSxFQUMxQztBQUNGO0FBRUEsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsTUFBTTtBQUFBLEVBQ04sUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLFdBQVc7QUFBQSxJQUNYLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxJQUNWO0FBQUEsRUFDRjtBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsY0FBYztBQUFBLEVBQ2hCO0FBQUEsRUFDQSxNQUFNO0FBQ1IsQ0FBQzsiLAogICJuYW1lcyI6IF
