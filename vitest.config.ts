import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    env: {
      APPLY_BACKEND_BASE_URL: "http://127.0.0.1:8000",
      APPLY_BACKEND_SERVICE_TOKEN: "test-service-token-at-least-32-bytes",
    },
  },
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
});
