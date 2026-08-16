import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Served from https://<user>.github.io/IELTS_emulator_V2/ in production, so assets
// must be prefixed with that base path. Dev stays at root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/IELTS_emulator_V2/' : '/',
  plugins: [react(), tailwindcss()],
}))
