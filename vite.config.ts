import { defineConfig } from 'vite';

// Vite serves /src as a normal web app (this is the build that Vercel deploys,
// and the same build Electron loads from dist/ in production).
export default defineConfig({
  base: './',            // relative paths so it works under file:// inside Electron too
  server: { port: 5173 },
  build: { outDir: 'dist', emptyOutDir: true }
});
