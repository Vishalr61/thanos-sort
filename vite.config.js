import { defineConfig } from 'vite';

/**
 * Vite config — kept minimal so the existing static GitHub Pages deploy
 * still works when index.html is served directly (no build step required
 * for local development; just `npx serve .`).
 *
 * `npm run build` produces a `dist/` folder with hashed assets if you want
 * a content-hashed deploy. To switch the GitHub Action to use Vite, change
 * the deploy step to `npm ci && npm run build && upload dist/`.
 */
export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: 'index.html'
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
