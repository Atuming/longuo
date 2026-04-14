import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const manualChunksMap: Record<string, string[]> = {
  'vendor-react': ['react', 'react-dom'],
  'vendor-router': ['react-router-dom', 'react-router'],
  'vendor-codemirror': [
    '@codemirror/autocomplete',
    '@codemirror/commands',
    '@codemirror/lang-markdown',
    '@codemirror/language-data',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
  ],
  'vendor-export': ['jspdf', 'jszip'],
}

function isPackageModule(id: string, pkg: string): boolean {
  // Normalize path separators for cross-platform compatibility
  const normalizedId = id.replace(/\\/g, '/')
  return normalizedId.includes(`/node_modules/${pkg}/`)
}

export default defineConfig({
  plugins: [react()],
  base: '/longuo/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          for (const [chunkName, packages] of Object.entries(manualChunksMap)) {
            if (packages.some((pkg) => isPackageModule(id, pkg))) {
              return chunkName
            }
          }
        },
      },
    },
  },
})
