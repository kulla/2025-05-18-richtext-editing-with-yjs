import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

export default defineConfig({
  html: {
    title: 'Rich Text Editing with Yjs',
  },
  output: {
    assetPrefix: '/2025-05-18-richtext-editing-with-yjs/',
  },
  plugins: [pluginReact()],
})
