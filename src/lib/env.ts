const raw = import.meta.env.VITE_API_URL as string | undefined;

if (!raw && !import.meta.env.DEV) {
  throw new Error(
    'VITE_API_URL is not set. The production build must be configured with the backend URL ' +
      '(e.g. https://api.stato.app). Falling back to localhost would break every page in the browser.',
  );
}

export const API_URL = raw || 'http://localhost:3001';
