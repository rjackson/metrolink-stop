import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The map's basemap chunk is ~875 kB, nearly all of it maplibre-gl, which ships pre-bundled and can't be split
    // further. It's only loaded on the map page, so allow for it rather than warn on every build
    chunkSizeWarningLimit: 900,
  },
});
