import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const googleOAuthHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Cross-Origin-Embedder-Policy': 'unsafe-none',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    headers: googleOAuthHeaders,
  },
  preview: {
    headers: googleOAuthHeaders,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './test/setup.ts',
  },
})
