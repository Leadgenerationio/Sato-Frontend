import { toast } from 'sonner';
import { logError } from './log';

// Render an HTML document into a hidden, same-origin iframe and open the
// browser's print / "Save as PDF" dialog for it.
//
// Why an iframe (not window.open): a popup is silently killed by popup blockers
// and a document.write'd about:blank popup prints unreliably in current
// Chromium. A hidden iframe is popup-blocker-proof and prints reliably.
//
// Cleanup is driven by `afterprint` (fires on both print and cancel, in all
// current browsers) with a long fallback timer as a safety net. We deliberately
// do NOT tear down on a window 'focus' event: focus can return to the page
// before a non-blocking print() has read the document, which would remove the
// iframe mid-print and produce a blank PDF.
//
// Pass a complete HTML document string. Do not embed a <script> that calls
// print() — this helper drives printing itself.
export function printHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';

  let cleaned = false;
  let safetyTimer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (safetyTimer) clearTimeout(safetyTimer);
    iframe.remove();
  };

  // If the iframe never loads (e.g. a sandbox/CSP that blocks srcdoc), clean up
  // and surface an error instead of leaking a detached iframe forever.
  const loadGuard = setTimeout(() => {
    cleanup();
    toast.error('Could not generate the PDF. Please try again.');
  }, 5000);

  iframe.onload = () => {
    clearTimeout(loadGuard);
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      toast.error('Could not generate the PDF. Please try again.');
      return;
    }
    win.onafterprint = cleanup;
    safetyTimer = setTimeout(cleanup, 60000);
    try {
      win.focus();
      win.print();
    } catch (err) {
      logError('printHtml: failed to open print dialog', err);
      toast.error('Could not open the print dialog.');
      cleanup();
    }
  };

  document.body.appendChild(iframe);
  iframe.srcdoc = html;
}
