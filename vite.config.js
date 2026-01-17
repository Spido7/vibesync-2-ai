import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@xenova/transformers'] // Critical for the AI library
  },
  build: {
    target: 'esnext' // AI libraries need modern JavaScript features
  }
})