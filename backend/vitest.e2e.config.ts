import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.e2e-spec.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      '@banex/types': resolve(__dirname, '../packages/types/src/index.ts'),
      '@banex/utils': resolve(__dirname, '../packages/utils/src/index.ts'),
    },
  },
})
