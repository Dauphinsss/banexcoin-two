import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      '@banex/types': resolve(__dirname, '../packages/types/src/index.ts'),
      '@banex/utils': resolve(__dirname, '../packages/utils/src/index.ts'),
    },
  },
})
