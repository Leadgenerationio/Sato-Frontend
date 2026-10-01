import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '@/pages/login';

vi.mock('@/components/providers/auth-provider', () => ({ useAuth: () => ({ user: null, login: vi.fn() }) }));

// Retest R3-2: the show-password eye was skipped by Tab (tabIndex -1), 30px, and named only by a tooltip.
describe('LoginPage — show-password button', () => {
  const setup = () => render(<MemoryRouter><LoginPage /></MemoryRouter>);

  it('is a named, keyboard-reachable button', () => {
    setup();
    const eye = screen.getByRole('button', { name: 'Show password' });
    expect(eye).toHaveAttribute('aria-pressed', 'false');
    expect(eye.getAttribute('tabindex')).not.toBe('-1');
  });

  it('toggles the field and its own name', () => {
    setup();
    const field = document.getElementById('password') as HTMLInputElement;
    expect(field.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field.type).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('says Stato in the heading', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sign in to Stato');
  });
});
