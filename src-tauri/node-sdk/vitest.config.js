import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/**/*.vitest.test.{js,mjs,cjs,ts,mts,cts}', 'lib/**/*.vitest.spec.{js,mjs,cjs,ts,mts,cts}'],
    exclude: [
      '**/node_modules/**',
      'lib/**/*.example.js',
      // Exclude old custom test scripts (but not *.vitest.test.js files)
      'lib/**/!(*.vitest).test.js',
      'lib/**/!(*.vitest).spec.js',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.js'],
      exclude: [
        'lib/**/*.test.js',
        'lib/**/*.vitest.test.js',
        'lib/**/*.spec.js',
        'lib/**/*.example.js',
      ],
    },
    testTimeout: 30000, // 30s for model loading
  },
});
