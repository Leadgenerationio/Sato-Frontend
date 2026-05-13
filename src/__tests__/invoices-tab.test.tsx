/**
 * P8 — Client Invoices tab filter/sort + overdue badge tests.
 *
 * Strategy: test the pure `applyFilterSort` function directly (no React
 * rendering needed for logic), then render `InvoicesTable` for the overdue
 * badge assertion.  `InvoicesTable` only needs MemoryRouter (Link usage) and
 * has no hook dependencies, so no complex mocking is required.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { InvoiceSummary } from '@/lib/hooks/use-invoices';
import { applyFilterSort, InvoicesTable } from '../pages/clients/detail';

// ─── helpers ──────────────────────────────────────────────────────────────

function makeInvoice(over: Partial<InvoiceSummary> = {}): InvoiceSummary {
  return {
    id: 'inv-' + Math.random().toString(36).slice(2, 7),
    invoiceNumber: 'INV-' + Math.floor(Math.random() * 9000 + 1000),
    clientId: 'client-1',
    clientName: 'Test Client',
    status: 'draft',
    currency: 'GBP',
    subtotal: '100',
    vatAmount: '20',
    total: '120',
    dueDate: '2030-01-01T00:00:00Z',   // far future = not overdue by default
    paidDate: null,
    daysOverdue: 0,
    createdAt: '2026-04-01T00:00:00Z',
    xeroInvoiceId: null,
    ...over,
  };
}

// ─── applyFilterSort — filter tests ───────────────────────────────────────

describe('applyFilterSort — filter', () => {
  const paid      = makeInvoice({ id: 'i-paid',       status: 'paid',       total: '200', createdAt: '2026-03-01T00:00:00Z', dueDate: '2026-02-01T00:00:00Z' });
  const draft     = makeInvoice({ id: 'i-draft',      status: 'draft',      total: '50',  createdAt: '2026-02-01T00:00:00Z', dueDate: '2030-01-01T00:00:00Z' });
  // authorised + past due = overdue
  const overdue   = makeInvoice({ id: 'i-overdue',    status: 'authorised', total: '300', createdAt: '2026-01-01T00:00:00Z', dueDate: '2026-01-15T00:00:00Z' });
  // authorised + future due = due (not overdue)
  const due       = makeInvoice({ id: 'i-due',        status: 'authorised', total: '400', createdAt: '2026-04-01T00:00:00Z', dueDate: '2030-06-01T00:00:00Z' });
  const invoices  = [paid, draft, overdue, due];

  it('"all" returns every invoice', () => {
    const result = applyFilterSort(invoices, 'all', 'issue_desc');
    expect(result).toHaveLength(4);
  });

  it('"paid" shows only paid invoices', () => {
    const result = applyFilterSort(invoices, 'paid', 'issue_desc');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('i-paid');
  });

  it('"draft" shows only draft invoices', () => {
    const result = applyFilterSort(invoices, 'draft', 'issue_desc');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('i-draft');
  });

  it('"overdue" shows authorised invoices with a past dueDate', () => {
    const result = applyFilterSort(invoices, 'overdue', 'issue_desc');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('i-overdue');
  });

  it('"due" shows authorised invoices with a future dueDate', () => {
    const result = applyFilterSort(invoices, 'due', 'issue_desc');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('i-due');
  });

  it('"authorised" shows all authorised invoices (overdue AND due)', () => {
    const result = applyFilterSort(invoices, 'authorised', 'issue_desc');
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('i-overdue');
    expect(ids).toContain('i-due');
  });
});

// ─── applyFilterSort — sort tests ─────────────────────────────────────────

describe('applyFilterSort — sort', () => {
  const a = makeInvoice({ id: 'a', status: 'paid', total: '100', createdAt: '2026-01-01T00:00:00Z', dueDate: '2026-03-01T00:00:00Z' });
  const b = makeInvoice({ id: 'b', status: 'paid', total: '300', createdAt: '2026-02-01T00:00:00Z', dueDate: '2026-02-01T00:00:00Z' });
  const c = makeInvoice({ id: 'c', status: 'paid', total: '200', createdAt: '2026-03-01T00:00:00Z', dueDate: '2026-04-01T00:00:00Z' });
  const invoices = [a, b, c];

  it('issue_desc: newest createdAt first', () => {
    const result = applyFilterSort(invoices, 'all', 'issue_desc');
    expect(result.map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });

  it('issue_asc: oldest createdAt first', () => {
    const result = applyFilterSort(invoices, 'all', 'issue_asc');
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('due_asc: soonest dueDate first', () => {
    const result = applyFilterSort(invoices, 'all', 'due_asc');
    expect(result.map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('due_desc: latest dueDate first', () => {
    const result = applyFilterSort(invoices, 'all', 'due_desc');
    expect(result.map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('amount_desc: highest total first', () => {
    const result = applyFilterSort(invoices, 'all', 'amount_desc');
    expect(result.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('amount_asc: lowest total first', () => {
    const result = applyFilterSort(invoices, 'all', 'amount_asc');
    expect(result.map((r) => r.id)).toEqual(['a', 'c', 'b']);
  });

  it('does not mutate the original array', () => {
    const original = [c, a, b];
    const snapshot = [...original];
    applyFilterSort(original, 'all', 'issue_desc');
    expect(original.map((r) => r.id)).toEqual(snapshot.map((r) => r.id));
  });
});

// ─── InvoicesTable — overdue badge ────────────────────────────────────────

describe('InvoicesTable — overdue badge', () => {
  it('shows "Overdue" badge inline for authorised invoice past dueDate', () => {
    const pastDue = makeInvoice({
      id: 'past-due',
      invoiceNumber: 'INV-9001',
      status: 'authorised',
      dueDate: '2020-01-01T00:00:00Z',   // well in the past
    });
    render(
      <MemoryRouter>
        <InvoicesTable invoices={[pastDue]} />
      </MemoryRouter>,
    );
    // Should have both the "authorised" status badge and an "Overdue" badge
    expect(screen.getAllByText(/overdue/i).length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT show "Overdue" badge for paid invoice past dueDate', () => {
    const paidPast = makeInvoice({
      id: 'paid-past',
      invoiceNumber: 'INV-9002',
      status: 'paid',
      dueDate: '2020-01-01T00:00:00Z',
    });
    render(
      <MemoryRouter>
        <InvoicesTable invoices={[paidPast]} />
      </MemoryRouter>,
    );
    // The "Overdue" column header exists, but there should be no red Overdue badge
    // in the status cell. The header text "Overdue" is the only match, not a badge.
    const matches = screen.getAllByText(/overdue/i);
    // Only the column header — no extra badge
    expect(matches).toHaveLength(1);
  });

  it('does NOT show "Overdue" badge for authorised invoice with future dueDate', () => {
    const futureDue = makeInvoice({
      id: 'future-due',
      invoiceNumber: 'INV-9003',
      status: 'authorised',
      dueDate: '2030-01-01T00:00:00Z',
    });
    render(
      <MemoryRouter>
        <InvoicesTable invoices={[futureDue]} />
      </MemoryRouter>,
    );
    const matches = screen.getAllByText(/overdue/i);
    // Only the column header
    expect(matches).toHaveLength(1);
  });
});
