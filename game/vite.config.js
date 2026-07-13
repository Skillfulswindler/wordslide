import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2019', outDir: 'dist' },
  server: { host: true, port: 5173 }
});
