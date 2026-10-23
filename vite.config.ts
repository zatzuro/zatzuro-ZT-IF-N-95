import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/zatzuro-ZT-IF-N-95/' : '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts', clearMocks: true },
});
