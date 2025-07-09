import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api/iam': {
        target: 'https://iam.cloud.ibm.com/identity/token',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/iam/, ''),
        secure: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EduBot/1.0)'
        }
      },
      '/api/watsonx': {
        target: 'https://au-syd.ml.cloud.ibm.com/ml/v1/text/chat?version=2023-05-29',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/watsonx/, ''),
        secure: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EduBot/1.0)'
        }
      }
    }
  }
});