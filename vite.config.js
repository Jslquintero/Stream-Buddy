import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
const backend = 'http://127.0.0.1:17900';
export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve('web/src') } },
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    proxy: {
      '/api': {
        target: backend,
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (request, incoming) => {
            if (incoming.headers.origin) request.setHeader('Origin', backend);
          });
        },
      },
    },
  },
});
