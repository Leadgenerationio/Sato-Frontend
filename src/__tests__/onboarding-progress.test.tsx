import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingProgress } from '../pages/clients/detail';

// Sam (2026-05-15 Loom) asked for the onboarding lifecycle to be visible
// inline instead of hidden in a tab. These tests pin the rendering of the
// extracted progress strip for each stage so a future regression that
// silently breaks the stage label or the agreement pill is caught fast.

describe('OnboardingProgress', () => {
  it('shows all 4 stage labels regardless of current status', () => {
    render(<OnboardingProgress onboardingStatus="pending" agreementSigned={false} />);
    for (const label of ['Pending', 'Documents', 'Agreement', 'Active']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('shows "Stage 1 of 4 · Pending" when onboardingStatus is pending', () => {
    render(<OnboardingProgress onboardingStatus="pending" agreementSigned={false} />);
    expect(screen.getByText(/Stage 1 of 4 · Pending/)).toBeInTheDocument();
    expect(screen.getByText('Not signed')).toBeInTheDocument();
  });

  it('shows "Stage 2 of 4 · Documents" for documents_received', () => {
    render(<OnboardingProgress onboardingStatus="documents_received" agreementSigned={false} />);
    expect(screen.getByText(/Stage 2 of 4 · Documents/)).toBeInTheDocument();
  });

  it('shows "Stage 3 of 4 · Agreement" + Signed pill when agreement_signed', () => {
    render(<OnboardingProgress onboardingStatus="agreement_signed" agreementSigned={true} />);
    expect(screen.getByText(/Stage 3 of 4 · Agreement/)).toBeInTheDocument();
    expect(screen.getByText('Signed')).toBeInTheDocument();
  });

  it('shows "Stage 4 of 4 · Active" when onboardingStatus is active', () => {
    render(<OnboardingProgress onboardingStatus="active" agreementSigned={true} />);
    expect(screen.getByText(/Stage 4 of 4 · Active/)).toBeInTheDocument();
  });

  // Unknown / legacy values shouldn't crash the strip — Sam may still have
  // older 'prospect'/'lead' clients in his data and we'd rather render
  // something sensible than blow up the whole client page.
  it('falls back to stage 1 for an unknown onboardingStatus', () => {
    render(<OnboardingProgress onboardingStatus="prospect" agreementSigned={false} />);
    expect(screen.getByText(/Stage 1 of 4 · Pending/)).toBeInTheDocument();
  });
});
