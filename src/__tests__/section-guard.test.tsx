import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SectionGuard } from '@/components/shared/section-guard';
import { sectionForPath } from '@/components/layouts/sidebar';

let mockSections: string[] | undefined;
vi.mock('@/lib/hooks/use-permissions', () => ({ useMySections: () => ({ data: mockSections }) }));
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', role: 'finance_admin' } }),
}));

const at = (path: string) => render(
  <MemoryRouter initialEntries={[path]}><SectionGuard><p>page body</p></SectionGuard></MemoryRouter>,
);

beforeEach(() => { mockSections = undefined; });

describe('sectionForPath', () => {
  it.each([
    ['/', 'dashboard'], ['/finance/bank-feed', 'bank_feed'], ['/finance/invoices/new', 'invoices'],
    ['/clients/abc', 'clients'], ['/leadbyte/deliveries', 'leadbyte'], ['/reports/unified', 'reports'],
    ['/reports/ad-spend', 'reports'], ['/settings', 'settings'], ['/tasks/123', 'tasks'],
  ])('%s → %s', (path, key) => expect(sectionForPath(path)).toBe(key));

  it('does not match a prefix that is only a partial word', () => {
    expect(sectionForPath('/clientsx')).toBeUndefined();
  });
});

describe('SectionGuard (S7)', () => {
  it('explains instead of rendering a page the matrix switched off', () => {
    mockSections = ['dashboard', 'invoices'];
    at('/finance/bank-feed');
    expect(screen.getByText("You don't have access to this section")).toBeInTheDocument();
    expect(screen.queryByText('page body')).not.toBeInTheDocument();
  });

  it('renders the page when the section is allowed', () => {
    mockSections = ['bank_feed'];
    at('/finance/bank-feed');
    expect(screen.getByText('page body')).toBeInTheDocument();
  });

  it('renders the page while /permissions/me has no answer (route guards still apply)', () => {
    mockSections = undefined;
    at('/finance/bank-feed');
    expect(screen.getByText('page body')).toBeInTheDocument();
  });
});
