import { defineConfig } from "vite";

/** Producción: https://clinicosdoc.com — GitHub Pages */
export default defineConfig({
  base: "/",
  build: {
    target: "es2022",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          parser: ["./src/services/document-parser.ts"],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
