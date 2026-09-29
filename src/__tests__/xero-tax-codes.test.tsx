import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// The panel gates itself to Owners.
vi.mock('@/components/providers/auth-provider', () => ({ useAuth: () => ({ user: { role: 'owner' } }) }));

// S4 (Sam feedback 2026-09-29): Owner sets the Xero tax type per VAT treatment.
const get = vi.fn();
const put = vi.fn();
vi.mock('@/lib/api', () => ({
  api: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a) },
  unwrap: <T,>(res: { data: T }) => res.data,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { XeroTaxCodes } from '@/components/settings/xero-tax-codes';

const DEFAULTS = { uk_standard: 'OUTPUT2', uk_zero_rated: 'ZERORATEDOUTPUT', reverse_charge: 'NONE', outside_scope: 'NONE' };

function renderIt() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><XeroTaxCodes /></QueryClientProvider>);
}

describe('XeroTaxCodes', () => {
  beforeEach(() => {
    get.mockReset(); put.mockReset();
    get.mockResolvedValue({ data: { taxTypes: DEFAULTS, defaults: DEFAULTS, known: ['OUTPUT2', 'ZERORATEDOUTPUT', 'EXEMPTOUTPUT', 'NONE', 'ECZROUTPUT', 'ECZROUTPUTSERVICES'] } });
  });

  it('shows the current code for every VAT treatment', async () => {
    renderIt();
    expect(await screen.findByLabelText('Reverse charge (EU / international B2B)')).toHaveValue('NONE');
    expect(screen.getByLabelText('UK VAT (standard rate)')).toHaveValue('OUTPUT2');
    expect(screen.getByLabelText('UK VAT (zero-rated)')).toHaveValue('ZERORATEDOUTPUT');
    expect(screen.getByLabelText('No VAT (outside scope)')).toHaveValue('NONE');
    expect(screen.getByRole('button', { name: 'Save tax codes' })).toBeDisabled();
  });

  it('asks to confirm, then saves only what changed', async () => {
    put.mockResolvedValue({ data: { taxTypes: { ...DEFAULTS, reverse_charge: 'ECZROUTPUTSERVICES' } } });
    const user = userEvent.setup();
    renderIt();
    await user.selectOptions(await screen.findByLabelText('Reverse charge (EU / international B2B)'), 'ECZROUTPUTSERVICES');
    await user.click(screen.getByRole('button', { name: 'Save tax codes' }));
    expect(await screen.findByText('Change the Xero tax codes?')).toBeInTheDocument();
    expect(screen.getByText(/NONE → ECZROUTPUTSERVICES/)).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/api/v1/settings/xero-tax-types', { taxTypes: { reverse_charge: 'ECZROUTPUTSERVICES' } }));
  });

  it('accepts a custom code but blocks one that isn\'t a Xero tax type', async () => {
    const user = userEvent.setup();
    renderIt();
    await user.selectOptions(await screen.findByLabelText('No VAT (outside scope)'), '__custom__');
    const input = screen.getByLabelText('No VAT (outside scope) — custom Xero tax type');
    await user.clear(input);
    await user.type(input, 'x');
    expect(screen.getByRole('alert')).toHaveTextContent('2–20 capital letters');
    expect(screen.getByRole('button', { name: 'Save tax codes' })).toBeDisabled();
    await user.type(input, 'yz9');
    expect(input).toHaveValue('XYZ9');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save tax codes' })).toBeEnabled();
  });
});
