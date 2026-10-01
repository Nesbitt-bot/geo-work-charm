import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { offlinePlugin } from "./offline-plugin";
export default defineConfig({
  plugins: [react(), offlinePlugin()],
  base:
    (globalThis as unknown as { process: { env: Record<string, string> } })
      .process.env.VITE_BASE_PATH || "./",
});
