import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingProgress, resolveActualStage } from '../pages/clients/detail';

// Sam (2026-05-15 Loom) asked for the onboarding lifecycle to be visible
// inline instead of hidden in a tab. These tests pin the rendering of the
// extracted progress strip for each stage so a future regression that
// silently breaks the stage label or the agreement pill is caught fast.

describe('OnboardingProgress', () => {
  it('shows all 4 stage labels regardless of current status', () => {
    render(<OnboardingProgress onboardingStatus="pending" agreementSigned={false} documentsCount={0} />);
    for (const label of ['Pending', 'Documents', 'Agreement', 'Active']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('shows "Stage 1 of 4 · Pending" when onboardingStatus is pending', () => {
    render(<OnboardingProgress onboardingStatus="pending" agreementSigned={false} documentsCount={0} />);
    expect(screen.getByText(/Stage 1 of 4 · Pending/)).toBeInTheDocument();
    expect(screen.getByText('Not signed')).toBeInTheDocument();
  });

  it('shows "Stage 2 of 4 · Documents" for documents_received with docs uploaded', () => {
    render(<OnboardingProgress onboardingStatus="documents_received" agreementSigned={false} documentsCount={2} />);
    expect(screen.getByText(/Stage 2 of 4 · Documents/)).toBeInTheDocument();
  });

  it('shows "Stage 3 of 4 · Agreement" + Signed pill when agreement_signed (with docs)', () => {
    render(<OnboardingProgress onboardingStatus="agreement_signed" agreementSigned={true} documentsCount={2} />);
    expect(screen.getByText(/Stage 3 of 4 · Agreement/)).toBeInTheDocument();
    expect(screen.getByText('Signed')).toBeInTheDocument();
  });

  it('shows "Stage 4 of 4 · Active" when onboardingStatus is active (with docs + signature)', () => {
    render(<OnboardingProgress onboardingStatus="active" agreementSigned={true} documentsCount={3} />);
    expect(screen.getByText(/Stage 4 of 4 · Active/)).toBeInTheDocument();
  });

  // Unknown / legacy values shouldn't crash the strip — Sam may still have
  // older 'prospect'/'lead' clients in his data and we'd rather render
  // something sensible than blow up the whole client page.
  it('falls back to stage 1 for an unknown onboardingStatus', () => {
    render(<OnboardingProgress onboardingStatus="prospect" agreementSigned={false} documentsCount={0} />);
    expect(screen.getByText(/Stage 1 of 4 · Pending/)).toBeInTheDocument();
  });

  // The reality-check downgrade — the bug we're fixing. UKESN had enum=active
  // but 0 docs uploaded and an unsigned agreement, so the green-tick display
  // was lying.
  it('downgrades enum="active" to "Pending" when no docs are uploaded', () => {
    render(<OnboardingProgress onboardingStatus="active" agreementSigned={false} documentsCount={0} />);
    expect(screen.getByText(/Stage 1 of 4 · Pending/)).toBeInTheDocument();
  });

  it('downgrades enum="active" to "Documents" when docs exist but agreement unsigned', () => {
    render(<OnboardingProgress onboardingStatus="active" agreementSigned={false} documentsCount={1} />);
    expect(screen.getByText(/Stage 2 of 4 · Documents/)).toBeInTheDocument();
  });

  it('downgrades enum="agreement_signed" to "Pending" when no docs', () => {
    render(<OnboardingProgress onboardingStatus="agreement_signed" agreementSigned={true} documentsCount={0} />);
    expect(screen.getByText(/Stage 1 of 4 · Pending/)).toBeInTheDocument();
  });
});

describe('resolveActualStage', () => {
  it('caps at 0 (pending) when no docs uploaded, regardless of enum', () => {
    expect(resolveActualStage('active', true, 0)).toBe(0);
    expect(resolveActualStage('agreement_signed', true, 0)).toBe(0);
    expect(resolveActualStage('documents_received', false, 0)).toBe(0);
    expect(resolveActualStage('pending', false, 0)).toBe(0);
  });

  it('caps at 1 (documents) when docs exist but agreement unsigned', () => {
    expect(resolveActualStage('active', false, 5)).toBe(1);
    expect(resolveActualStage('agreement_signed', false, 5)).toBe(1);
    expect(resolveActualStage('documents_received', false, 5)).toBe(1);
  });

  it('trusts the enum when docs exist and agreement signed', () => {
    expect(resolveActualStage('active', true, 5)).toBe(3);
    expect(resolveActualStage('agreement_signed', true, 5)).toBe(2);
    expect(resolveActualStage('documents_received', true, 5)).toBe(1);
  });
});
