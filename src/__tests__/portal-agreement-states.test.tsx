import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// The page used to show its loading skeleton forever when the client had no
// agreement (or the request failed): loading, error and empty shared a branch.
const state: { data: unknown; isLoading: boolean; isError: boolean } = { data: undefined, isLoading: false, isError: false };
vi.mock('@/lib/hooks/use-portal', () => ({ usePortalAgreement: () => state }));
vi.mock('@/lib/hooks/use-page-title', () => ({ usePageTitle: () => {} }));

import { PortalAgreementPage } from '@/pages/portal/agreement';

describe('PortalAgreementPage states', () => {
  beforeEach(() => { state.data = undefined; state.isLoading = false; state.isError = false; });

  it('shows "No agreement yet" when there is no agreement', () => {
    render(<PortalAgreementPage />);
    expect(screen.getByText('No agreement yet')).toBeInTheDocument();
  });

  it('shows a plain error when the request fails', () => {
    state.isError = true;
    render(<PortalAgreementPage />);
    expect(screen.getByText("Couldn't load your agreement")).toBeInTheDocument();
  });

  it('only shows the skeleton while loading', () => {
    state.isLoading = true;
    const { container } = render(<PortalAgreementPage />);
    expect(screen.queryByText('No agreement yet')).toBeNull();
    expect(container.querySelector('[data-slot=skeleton], .animate-pulse')).not.toBeNull();
  });
});
