import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    rollupOptions: {
      external: ['katex'],
      output: {
        globals: {
          katex: 'katex',
        },
      },
    },
  },
})
