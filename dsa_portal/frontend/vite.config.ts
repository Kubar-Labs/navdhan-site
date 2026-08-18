import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const requireEnv = (name: string): string => {
    const value = env[name]?.trim()
    if (!value) {
      throw new Error(
        `${name} is not set. Copy .env.example to .env and fill it in — ` +
          'there is no built-in default, so a missing value fails here rather ' +
          'than silently pointing the app at the wrong backend.',
      )
    }
    return value
  }

  const requirePort = (name: string): number => {
    const raw = requireEnv(name)
    const port = Number(raw)
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error(`${name} must be a valid port number, got "${raw}".`)
    }
    return port
  }

  // Vite inlines this into the bundle, so it must be present for builds too —
  // catching it here beats shipping an app that throws on first load.
  requireEnv('VITE_API_BASE_URL')

  return {
    // Served under /apply on the marketing-site domain (reverse-proxied).
    base: '/apply/',
    plugins: [react()],
    // Dev-server settings only. `vite build` never starts a server, so
    // requiring them for a build would break CI, which has no dev config.
    server:
      command === 'serve'
        ? {
            port: requirePort('PORT'),
            proxy: {
              '/api': requireEnv('VITE_BACKEND_URL'),
            },
          }
        : undefined,
  }
})
