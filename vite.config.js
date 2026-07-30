import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: '/eat-with-me-/',
    server: { host: '0.0.0.0' },
    plugins: [react()],
    define: {
      'import.meta.env.VITE_GA_MEASUREMENT_ID': JSON.stringify(env.VITE_GA_MEASUREMENT_ID || ''),
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => {
        const id = env.VITE_GA_MEASUREMENT_ID || ''
        return html.replace(/%VITE_GA_MEASUREMENT_ID%/g, id)
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
    },
  }
})
