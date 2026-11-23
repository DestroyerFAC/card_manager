import { createReadStream, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const require = createRequire(import.meta.url);

/**
 * Tesseract.js loads its worker and WASM core with importScripts(). Serving them from our own
 * origin (instead of the default jsDelivr URLs) keeps `script-src 'self'` in the CSP and pins the
 * exact versions installed by npm. Only LSTM cores are shipped because we use OEM.LSTM_ONLY.
 */
function tesseractAssets(): Plugin {
  const workerFile = require.resolve('tesseract.js/dist/worker.min.js');
  const coreDir = path.dirname(require.resolve('tesseract.js-core/package.json'));
  const files: Record<string, string> = {
    'worker.min.js': workerFile,
    'tesseract-core-lstm.wasm.js': path.join(coreDir, 'tesseract-core-lstm.wasm.js'),
    'tesseract-core-simd-lstm.wasm.js': path.join(coreDir, 'tesseract-core-simd-lstm.wasm.js'),
    'tesseract-core-relaxedsimd-lstm.wasm.js': path.join(
      coreDir,
      'tesseract-core-relaxedsimd-lstm.wasm.js',
    ),
  };
  const prefix = '/tesseract/';

  return {
    name: 'tesseract-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (!url?.startsWith(prefix)) return next();
        const source = files[url.slice(prefix.length)];
        if (!source) return next();
        res.setHeader('Content-Type', 'text/javascript');
        createReadStream(source).pipe(res);
      });
    },
    generateBundle() {
      for (const [name, source] of Object.entries(files)) {
        this.emitFile({
          type: 'asset',
          fileName: `tesseract/${name}`,
          source: readFileSync(source),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tesseractAssets(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Card Manager – Collection TCG',
        short_name: 'CardManager',
        description: 'Gérez et estimez votre collection de cartes Pokémon (projet non officiel).',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // The OCR engine weighs ~4 MB per core: cached on first scan instead of at install time.
        globIgnores: ['tesseract/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/tesseract\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://assets.tcgdex.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'tcgdex-images',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
              // Images are <img> no-cors loads: opaque responses report status 0.
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://api.tcgdex.net',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tcgdex-api',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith('/tesseract/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract-runtime',
              expiration: { maxEntries: 8 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
