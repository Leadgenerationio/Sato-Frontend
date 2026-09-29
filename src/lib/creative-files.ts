// Creative library (Sam feedback round 1, M2 — plan phase 1). Browser-side
// checks and metadata for creative uploads: images and videos only, 50 MB
// cap (matches the /uploads/presign limit), SHA-256 fingerprint and
// width / height / duration read before the file leaves the browser so the
// server can de-duplicate and the grid can show dimensions.

export const MAX_CREATIVE_BYTES = 50 * 1024 * 1024;

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'];
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'm4v'];

export type CreativeMediaType = 'image' | 'video';

export function mediaTypeOf(file: Pick<File, 'name' | 'type'>): CreativeMediaType | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (file.type.startsWith('image/') || (!file.type && IMAGE_EXT.includes(ext))) return 'image';
  if (file.type.startsWith('video/') || (!file.type && VIDEO_EXT.includes(ext))) return 'video';
  return null;
}

function formatMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** Plain-words reason a file can't be uploaded as a creative, or null when it can. */
export function creativeFileError(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  if (!mediaTypeOf(file)) return `${file.name}: only images and videos can be uploaded as creatives.`;
  if (file.size > MAX_CREATIVE_BYTES) return `${file.name}: file too large (${formatMb(file.size)}) — max 50 MB.`;
  if (file.size === 0) return `${file.name}: the file is empty.`;
  return null;
}

export const CREATIVE_ACCEPT = 'image/*,video/*';

/** Hex SHA-256 of the file's bytes (Web Crypto). */
export async function sha256Hex(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface MediaMeta { width?: number; height?: number; durationS?: number }

/** Width/height for images; width/height/duration for videos. Never throws — unknown fields stay undefined. */
export function readMediaMeta(file: File): Promise<MediaMeta> {
  const type = mediaTypeOf(file);
  if (!type || typeof URL.createObjectURL !== 'function') return Promise.resolve({});
  const url = URL.createObjectURL(file);
  const done = (meta: MediaMeta) => { URL.revokeObjectURL(url); return meta; };
  return new Promise<MediaMeta>((resolve) => {
    const timer = setTimeout(() => resolve(done({})), 8000);
    if (type === 'image') {
      const img = new Image();
      img.onload = () => { clearTimeout(timer); resolve(done({ width: img.naturalWidth || undefined, height: img.naturalHeight || undefined })); };
      img.onerror = () => { clearTimeout(timer); resolve(done({})); };
      img.src = url;
    } else {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve(done({
          width: v.videoWidth || undefined,
          height: v.videoHeight || undefined,
          durationS: Number.isFinite(v.duration) ? Math.round(v.duration * 100) / 100 : undefined,
        }));
      };
      v.onerror = () => { clearTimeout(timer); resolve(done({})); };
      v.src = url;
    }
  });
}

const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|gbraid|wbraid|msclkid|ttclid|tblci|_ga)$/i;

/**
 * Same normalisation the backend uses to de-duplicate landing pages
 * (plan §Design decisions 2): lower-case host, no tracking params, no
 * trailing slash, no fragment. Returns null for anything that isn't an
 * http(s) URL.
 */
export function normaliseLandingUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname.includes('.')) return null;
  u.hash = '';
  u.hostname = u.hostname.toLowerCase();
  for (const key of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
  let out = u.toString();
  if (u.pathname !== '/' && out.endsWith('/') && !u.search) out = out.slice(0, -1);
  if (u.pathname === '/' && !u.search) out = out.replace(/\/$/, '');
  return out;
}

export function landingUrlError(raw: string): string | null {
  if (!raw.trim()) return 'Enter the landing page URL.';
  return normaliseLandingUrl(raw) ? null : 'That isn\'t a web address — use the full page URL, e.g. https://example.com/offer.';
}

export function formatBytes(bytes: number | null | undefined) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return formatMb(bytes);
}

export function formatDuration(s: number | null | undefined) {
  if (s == null) return null;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`;
}
