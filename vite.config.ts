import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// VITE_PROXY_TARGET (dev only): when set, /api is proxied server-side to that
// backend. The browser then talks to the same-origin dev server, so there's no
// CORS — and we strip the Origin/Referer headers because the deployed backend
// 500s on disallowed (localhost) origins. Point VITE_API_URL at the dev origin
// (or leave relative) so requests hit /api on this server.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_PROXY_TARGET;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5174,
      strictPort: true,
      proxy: proxyTarget
        ? {
            '/api': {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
              configure: (proxy) => {
                proxy.on('proxyReq', (proxyReq) => {
                  // Server-to-server call — drop browser-origin headers the
                  // backend's CORS layer rejects (it returns 500 otherwise).
                  proxyReq.removeHeader('origin');
                  proxyReq.removeHeader('referer');
                });
              },
            },
          }
        : undefined,
    },
  };
});
