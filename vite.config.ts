import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.ELECTRON === 'true' ? './' : '/',
  server: {
    port: 5173,
    strictPort: true,
    // Note: Vite handles SPA routing automatically in development
  }
  // Production SPA routing is handled by the _redirects file for Netlify
})
