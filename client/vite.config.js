import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev: /api is proxied to the local game server (npm run dev in server/).
// Prod (iOS bundle): set VITE_API_URL to the hosted API, e.g.
//   https://isyndicate-api.fly.dev
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
