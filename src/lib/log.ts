const isDev = import.meta.env.DEV;

export function logError(...args: unknown[]): void {
  if (isDev) console.error(...args);
}

export function logWarn(...args: unknown[]): void {
  if (isDev) console.warn(...args);
}
