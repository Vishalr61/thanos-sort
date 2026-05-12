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
  // Two paths to `three` need reconciling:
  //  - The static GitHub Pages deploy uses the <script type="importmap"> in
  //    index.html, which maps `three/addons/` → `unpkg.../examples/jsm/`.
  //  - Vite's dev/build resolver looks for the npm package layout, which
  //    is `three/examples/jsm/`.
  // The alias below maps the importmap path onto the npm package layout
  // so both code paths use the same JS files unchanged.
  resolve: {
    alias: {
      'three/addons/': 'three/examples/jsm/'
    }
  },
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
