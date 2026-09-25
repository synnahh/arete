import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "fs";

const host     = process.env.TAURI_DEV_HOST;
const isPWA    = process.env.BUILD_TARGET === "pwa";
const pkg      = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig(async () => ({
  plugins: [
    react(),

    // PWA plugin — only active when building for Firebase Hosting
    ...(isPWA ? [VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["assets/valerie-logo.png", "assets/icon-192.png", "assets/icon-512.png"],
      manifest: {
        name: "VALERIE",
        short_name: "VALERIE",
        description: "Your personal AI assistant — health, tasks, finance & focus",
        theme_color: "#080808",
        background_color: "#080808",
        display: "standalone",
        orientation: "portrait",
        start_url: "/?mobile",
        scope: "/",
        icons: [
          {
            src: "/assets/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/assets/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/auth/],
        // Import push event handler into the generated service worker
        importScripts: ['/sw-push.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    })] : []),
  ],

  // Public assets directory
  publicDir: "src/public",

  // Tauri → src-tauri/frontend/  |  PWA → dist/
  build: {
    outDir: isPWA ? "dist" : "src-tauri/frontend",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Split vendor libs into their own chunk
        manualChunks: (id) => {
          if (id.includes('node_modules/firebase')) return 'vendor-firebase';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor-react';
          if (id.includes('node_modules/@tauri-apps')) return 'vendor-tauri';

          // Shared app modules FIRST — keeps common code out of the feature
          // chunks. Without this, a shared util could be hoisted into `mobile`
          // while `tab-settings` still imports it, producing a circular chunk
          // (mobile -> tab-settings -> mobile).
          if (id.includes('/src/utils/')     ||
              id.includes('/src/hooks/')     ||
              id.includes('/src/supabase/')  ||
              id.includes('/src/styles/')    ||
              id.includes('/src/ai/')) return 'shared';

          // MobileSettings re-exports the desktop Settings sections, so keep it
          // with tab-settings rather than letting `mobile` depend on it.
          if (id.includes('/src/mobile/screens/MobileSettings')) return 'tab-settings';

          // Heavy tabs into their own chunks for faster first-load parse
          if (id.includes('/src/tabs/Health')) return 'tab-health';
          if (id.includes('/src/tabs/Finance')) return 'tab-finance';
          if (id.includes('/src/tabs/Workout')) return 'tab-workout';
          if (id.includes('/src/tabs/Settings')) return 'tab-settings';
          if (id.includes('/src/mobile/')) return 'mobile';
        },
      },
    },
  },

  define: {
    __BUILD_TARGET__:  JSON.stringify(isPWA ? "pwa" : "tauri"),
    __APP_VERSION__:   JSON.stringify(pkg.version),
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
