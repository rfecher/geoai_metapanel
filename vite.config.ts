import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

export default defineConfig(() => ({
  plugins: [
    react(),
    electron({
      outDir: 'dist-electron',
      main: {
        entry: 'electron/main.ts',
        onstart: (options) => options.startup(),
        vite: {
          build: {
            rollupOptions: {
              output: { format: 'cjs' },
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            rollupOptions: {
              output: { format: 'cjs' },
            },
          },
        },
      },
    }),
  ],
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      // Proxy LM Studio requests to avoid CORS issues in development
      '/api/lmstudio': {
        target: 'http://localhost:1234',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/lmstudio/, ''),
      },
      // Proxy Ollama requests
      '/api/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
      },
      // Proxy MLX-LM requests
      '/api/mlxlm': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mlxlm/, ''),
      },
    },
  },
}));

