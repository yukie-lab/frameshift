import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/frameshift/' : '/',
  server: { port: 5173, strictPort: true },
  build: { target: 'esnext' }
}))
