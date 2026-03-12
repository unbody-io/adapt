import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3212,
    proxy: {
      '/api': {
        target: 'http://localhost:3211',
        changeOrigin: true,
      },
    },
  },
})
