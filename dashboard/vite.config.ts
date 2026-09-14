import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { liveApi } from "./vite-plugin-live";

export default defineConfig({
  plugins: [react(), liveApi()],
  server: { port: 5173, host: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
