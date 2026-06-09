import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LifeBuoy, Loader2, Send } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useSendSos } from '@/lib/hooks/use-sos';
import { useAuth } from '@/components/providers/auth-provider';

// Slice 5 Day 6 (Sam Loom #100). Floating SOS button — always visible for
// any authenticated user. On submit:
//   1. POSTs to /api/v1/sos so the server records the request (Sam sees
//      who's stuck even if the WA send never happens).
//   2. Opens the returned wa.me deep-link in a new tab with the message
//      pre-filled. The user still has to tap Send inside WhatsApp.
//
// When the backend hasn't been configured with a recipient number, we
// show a toast and the request is still logged.

export function SosButton() {
  const { user } = useAuth();
  const location = useLocation();
  const send = useSendSos();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  // Hide the button for unauthenticated users (login page etc.) — the API
  // requires auth and there's no point dangling a button that 401s.
  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await send.mutateAsync({
        pagePath: location.pathname,
        message: message.trim() || undefined,
      });
      setOpen(false);
      setMessage('');
      if (result.whatsappLink) {
        // Open in a new tab. window.open with `noopener` is the safe form;
        // on mobile this hands off to the WhatsApp app directly.
        window.open(result.whatsappLink, '_blank', 'noopener,noreferrer');
        toast.success("Request logged. Opening WhatsApp…");
      } else {
        toast.info('Request logged. WhatsApp link not configured yet — someone will follow up.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send SOS');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Get help"
          className="fixed bottom-5 right-5 z-50 flex h-12 items-center gap-2 rounded-full bg-negative px-4 text-sm font-medium text-white shadow-lg transition-colors hover:bg-negative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-negative/30"
        >
          <LifeBuoy className="size-5" />
          <span className="hidden sm:inline">SOS</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Need a hand?</DialogTitle>
          <DialogDescription>
            Drop a quick note. We'll log it and open WhatsApp pre-filled so you can send it to Sam.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's going on? (optional)"
            rows={4}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            We'll include the page you're on ({location.pathname}) so context isn't lost.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={send.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={send.isPending}>
              {send.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Send className="size-4 mr-1.5" />}
              Send SOS
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
