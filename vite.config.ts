import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the browser calls /api on the Vite server, which forwards to the
// Express backend. Secrets live only in the backend process.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': `http://localhost:${process.env.PORT || 8787}` },
  },
  preview: {
    proxy: { '/api': `http://localhost:${process.env.PORT || 8787}` },
  },
});
