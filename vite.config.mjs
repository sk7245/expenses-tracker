import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The React app lives in client/. `npm run build` puts the finished files in client/dist,
// and Express serves them. While developing, `npm run dev:client` runs Vite on port 5173
// and passes /api calls through to the Express server on port 3000.
export default defineConfig({
    root: "client",
    plugins: [react()],
    build: {
        outDir: "dist",
        emptyOutDir: true
    },
    server: {
        port: 5173,
        proxy: {
            "/api": "http://localhost:3000"
        }
    }
});
