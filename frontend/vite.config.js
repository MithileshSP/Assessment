import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
<<<<<<< HEAD
  base: '/fullstack/'
=======
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:6000',
        changeOrigin: true
      }
    }
  }
>>>>>>> 4abcbbc4511c75d6507e5492d9d4cf32b4a54f3f
})
