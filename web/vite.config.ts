import { defineConfig } from "vite";

/** Repo aparte en GitHub Pages: https://ceoclinicos.github.io/ClinicosDoc/ */
export default defineConfig({
  base: "/ClinicosDoc/",
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
