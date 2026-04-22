import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [tsconfigPaths()],
    resolve: {
        alias: {
            'server-only': new URL('./tests/stubs/server-only.ts', import.meta.url).pathname,
        },
    },
    test: {
        environment: 'node',
        setupFiles: ['./tests/setup.ts'],
        include: ['tests/unit/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['lib/**/*.ts'],
            exclude: ['**/*.test.ts', 'app/generated/**'],
        },
    },
});