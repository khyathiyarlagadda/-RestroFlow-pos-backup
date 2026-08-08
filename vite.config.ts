import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      devOptions: {
        enabled: true,
        type: 'module'
      },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'RestroFlow POS',
        short_name: 'RestroFlow',
        description: 'RestroFlow Restaurant POS System',
        theme_color: '#7B1E1E',
        background_color: '#FAF8F4',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Exclude Supabase REST and Auth endpoints from SW cache
            urlPattern: /^https:\/\/.*\.supabase\.co\/(rest|auth)\/v1\/.*/i,
            handler: 'NetworkOnly'
          },
          {
            // Cache static Google Fonts for offline app shell rendering
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'external-fonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          }
        ]
      }
    })
  ]
});
