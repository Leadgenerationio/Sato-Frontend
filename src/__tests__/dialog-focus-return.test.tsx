import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

// Sam feedback round 1, S15: "focus lost after closing dialogs". Most admin
// dialogs are opened from state with no <DialogTrigger>, so Radix had nothing
// to return focus to and it fell to <body>.
function StateOpenedDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button">Somewhere else</button>
      <button type="button" onClick={() => setOpen(true)}>Add User</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>Invite someone.</DialogDescription>
          <button type="button" onClick={() => setOpen(false)}>Cancel</button>
        </DialogContent>
      </Dialog>
    </>
  );
}

describe('DialogContent returns focus to what opened it', () => {
  it('after Escape', async () => {
    const user = userEvent.setup();
    render(<StateOpenedDialog />);
    await user.click(screen.getByRole('button', { name: 'Somewhere else' }));
    await user.click(screen.getByRole('button', { name: 'Add User' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add User' }));
  });

  it('after an in-dialog button closes it', async () => {
    const user = userEvent.setup();
    render(<StateOpenedDialog />);
    await user.click(screen.getByRole('button', { name: 'Add User' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add User' }));
  });
});
