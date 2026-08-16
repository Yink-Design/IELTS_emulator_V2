import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves this fork from
// https://yink-design.github.io/IELTS_emulator_V2/ in production.
// Keep local development at the root path.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/IELTS_emulator_V2/' : '/',
  plugins: [react(), tailwindcss()],
}))
