// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'popup',
  build: {
    outDir: '../dist/popup',
    emptyOutDir: true,
  },
});
