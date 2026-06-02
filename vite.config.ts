import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy OpenAI API calls to bypass CORS in development
      '/api/translate': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/translate/, '/v1/chat/completions'),
        secure: true,
      },
    },
  },
  // Ensure pdfjs-dist worker can be loaded
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
})
