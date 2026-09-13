import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/app/bootstrap.ts'),
      name: 'CloudRepublicNext',
      formats: ['iife'],
      fileName: () => 'cloud-republic-next.js'
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true
  }
});
