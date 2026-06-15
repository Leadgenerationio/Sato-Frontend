// DEV-ONLY helper — run the local frontend against the PRODUCTION backend.
//
// Prod CORS rejects localhost origins (returns 500 when it sees a disallowed
// Origin header), so the browser can't call prod directly. Instead the browser
// talks same-origin to the Vite dev server, and Vite proxies /api → prod
// server-side, stripping the Origin/Referer headers so prod accepts it.
//
// Run:  VITE_API_URL=http://localhost:5191 npx vite --config vite.local-prod.config.ts
// Then open http://localhost:5191 and log in with your real prod credentials.
//
// Not part of the restyle — safe to delete.
import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

const PROD_BACKEND = 'https://sato-backend-production.up.railway.app';

export default mergeConfig(
  base,
  defineConfig({
    server: {
      port: 5191,
      strictPort: true,
      proxy: {
        '/api': {
          target: PROD_BACKEND,
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Prod CORS 500s on a disallowed Origin; with no Origin it works.
              proxyReq.removeHeader('origin');
              proxyReq.removeHeader('referer');
            });
          },
        },
      },
    },
  }),
);
