import { defineConfig } from "vite";

export default defineConfig({
    base: "/",
    build: {
        target: "es2022",
        sourcemap: false,
        chunkSizeWarningLimit: 1500,
        rollupOptions: {
            output: {
                manualChunks: {
                    matrix: ["matrix-js-sdk"],
                    crypto: ["@matrix-org/matrix-sdk-crypto-wasm"],
                },
            },
        },
    },
});
