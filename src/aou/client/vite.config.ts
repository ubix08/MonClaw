import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: {
    outDir: "../public",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/ws": {
        target: "ws://127.0.0.1:80",
        ws: true,
      },
    },
  },
})
