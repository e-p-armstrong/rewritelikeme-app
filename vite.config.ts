import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Use relative paths in built files so they work under file:// in Electron
  base: command === 'build' ? './' : '/',
  server: {
    port: 5173,
    strictPort: true,
    // Note: Vite handles SPA routing automatically in development
  }
  // Production SPA routing is handled by the _redirects file for Netlify
}))
