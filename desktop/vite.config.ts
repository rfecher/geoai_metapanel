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
}));

