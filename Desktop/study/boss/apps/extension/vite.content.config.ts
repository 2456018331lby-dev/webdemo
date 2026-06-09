import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@job-assistant/shared': resolve(__dirname, '../../packages/shared/src/index.ts')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    copyPublicDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/main.ts'),
      formats: ['iife'],
      name: 'JobAssistantContent',
      fileName: () => 'content/main.js'
    }
  }
});
