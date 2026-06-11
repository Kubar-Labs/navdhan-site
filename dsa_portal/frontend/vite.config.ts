import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // Served under /apply on the marketing-site domain (reverse-proxied).
    base: '/apply/',
    plugins: [react()],
    server: {
      port: parseInt(env.PORT ?? '3000'),
      proxy: {
        '/api': env.VITE_BACKEND_URL ?? 'http://localhost:8000',
      },
    },
  }
})
