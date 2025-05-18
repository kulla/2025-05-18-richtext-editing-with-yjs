import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

export default defineConfig({
  html: {
    title: 'Prototype',
  },
  output: {
    assetPrefix: '/rsbuild-react-bun-biome-starter-template/',
  },
  plugins: [pluginReact()],
})
