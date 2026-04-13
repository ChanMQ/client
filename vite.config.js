import { defineConfig } from "vite";

export default defineConfig({
    base: "/",
    build: {
        target: "es2022",
        sourcemap: false,
        chunkSizeWarningLimit: 1400,
        rollupOptions: {
            output: {
                manualChunks: {
                    matrix: ["matrix-js-sdk"],
                },
            },
        },
    },
});
