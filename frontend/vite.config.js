import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allows LAN access when running `npm run dev`
    port: 5173, // You can change this if needed
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
