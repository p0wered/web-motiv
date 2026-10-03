import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Один чанк ~160 КБ в gzip (React, роутер, zod-схемы API) — для внутренней сети нормально.
    // Тяжёлые разделы (просмотр документов) будут грузиться отдельно, когда появятся.
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
