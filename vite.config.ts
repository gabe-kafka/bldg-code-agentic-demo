import { defineConfig, type Plugin } from 'vite'

function cdnExternals(): Plugin {
  return {
    name: 'cdn-externals',
    enforce: 'pre',
    resolveId(id) {
      if (id === 'katex') return '\0cdn:katex'
      return null
    },
    load(id) {
      if (id === '\0cdn:katex') return 'export default window.katex;'
      return null
    },
  }
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [cdnExternals()],
})
