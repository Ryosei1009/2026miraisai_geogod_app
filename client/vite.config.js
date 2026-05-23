import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const SERVER_PORT = 5173;

export default defineConfig({
  plugins: [react()],
  server: {
    port: SERVER_PORT
  }
});
