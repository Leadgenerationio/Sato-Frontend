// Trigger a browser "Save as" for an in-memory Blob (e.g. the original Xero
// invoice PDF the backend streams behind auth). Uses an object URL + a
// transient <a download> click, then revokes the URL so we don't leak it.
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoke on the next tick so the click has a chance to start the download
    // before the URL is invalidated (Safari is picky about same-tick revokes).
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
