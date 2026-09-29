// ─── Upload file rules (Sam feedback S9, 29 Sep 2026) ───────────────────────
//
// "Upload accepts anything (a .exe got as far as the upload request)". These
// rules run in the browser before we ask for a presigned URL; the backend
// enforces the same allow-list on /uploads/presign, so this is UX, not the
// security boundary.

/** Backend hard cap on /uploads/presign (upload.routes.ts presignSchema). */
export const SERVER_MAX_UPLOAD_MB = 50;

export interface UploadRule {
  /** Value for the <input accept> attribute. */
  accept: string;
  /** MIME prefixes/exact types allowed (checked against File.type). */
  mimeTypes: string[];
  /** Lower-case extensions allowed, used when the browser gives no MIME. */
  extensions: string[];
  /** Human description for the error message. */
  describe: string;
}

const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm'];
const VIDEO_EXT = ['mp4', 'mov', 'webm'];
const COPY_MIME = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const COPY_EXT = ['pdf', 'txt', 'doc', 'docx'];

/** Ad creative media — the "Media (image / video)" section. */
export const CREATIVE_MEDIA_RULE: UploadRule = {
  accept: [...IMAGE_MIME, ...VIDEO_MIME].join(','),
  mimeTypes: [...IMAGE_MIME, ...VIDEO_MIME],
  extensions: [...IMAGE_EXT, ...VIDEO_EXT],
  describe: 'images (PNG, JPG, GIF, WebP) or videos (MP4, MOV, WebM)',
};

/** "Copy & landing page" section — ad copy documents plus screenshots. */
export const CREATIVE_COPY_RULE: UploadRule = {
  accept: [...COPY_MIME, ...IMAGE_MIME].join(','),
  mimeTypes: [...COPY_MIME, ...IMAGE_MIME],
  extensions: [...COPY_EXT, ...IMAGE_EXT],
  describe: 'PDF, Word or text documents, or images',
};

/** Anything the creatives folder takes (union of both sections). */
export const CREATIVE_ANY_RULE: UploadRule = {
  accept: [...new Set([...CREATIVE_MEDIA_RULE.mimeTypes, ...CREATIVE_COPY_RULE.mimeTypes])].join(','),
  mimeTypes: [...new Set([...CREATIVE_MEDIA_RULE.mimeTypes, ...CREATIVE_COPY_RULE.mimeTypes])],
  extensions: [...new Set([...CREATIVE_MEDIA_RULE.extensions, ...CREATIVE_COPY_RULE.extensions])],
  describe: 'images, videos, or PDF / Word / text documents',
};

// Never accepted anywhere — executables and scripts.
const BLOCKED_EXT = [
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'dll', 'sh', 'ps1', 'vbs',
  'js', 'mjs', 'jar', 'app', 'dmg', 'pkg', 'apk', 'deb', 'rpm', 'hta', 'lnk',
];

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

/**
 * Returns a plain-words reason the file can't be uploaded, or null if OK.
 * `rule` is optional — without one only the size cap and the executable
 * block-list apply (general documents).
 */
export function checkUploadFile(file: File, maxSizeMB: number, rule?: UploadRule): string | null {
  const ext = extensionOf(file.name);
  if (BLOCKED_EXT.includes(ext)) {
    return `${file.name}: this file type can't be uploaded.`;
  }
  if (rule) {
    const mimeOk = !!file.type && rule.mimeTypes.includes(file.type.toLowerCase());
    const extOk = rule.extensions.includes(ext);
    // Trust the extension only when the browser couldn't tell us the MIME.
    if (!(mimeOk || (!file.type && extOk))) {
      return `${file.name}: not a supported file. Upload ${rule.describe}.`;
    }
  }
  const cap = Math.min(maxSizeMB, SERVER_MAX_UPLOAD_MB);
  if (file.size > cap * 1024 * 1024) {
    return `${file.name}: file too large (${formatMb(file.size)}). Max ${cap} MB.`;
  }
  if (file.size === 0) {
    return `${file.name}: the file is empty.`;
  }
  return null;
}
