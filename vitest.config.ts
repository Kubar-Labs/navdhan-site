import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    env: {
      // The apply proxy has no built-in backend URL, so tests that assert the
      // outgoing request need one configured the same way a real run does.
      APPLY_BACKEND_BASE_URL: "http://127.0.0.1:8000",
    },
  },
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
});
