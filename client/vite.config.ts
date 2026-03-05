import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Raise warning threshold to 600 kB (from default 500 kB)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split large vendor libraries into separate cacheable chunks
        manualChunks: {
          // React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Animation / DnD
          'vendor-motion': ['framer-motion', '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          // State + networking
          'vendor-state': ['zustand', 'axios'],
          // UI icons
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
