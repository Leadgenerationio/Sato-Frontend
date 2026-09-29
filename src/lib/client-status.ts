// Client status display — one source for the Clients list and client detail.
//
// Feedback M4 (29 Sep 2026): the UI used to relabel a stored 'active' client
// as "Onboarding" whenever no agreement was signed or no documents were
// uploaded, and showed 'paused' as "Client Churned". Result: every active
// client read "Onboarding" and the list disagreed with Edit Client and the
// Dashboard. We now always show the STORED status, and surface the missing
// agreement / documents as separate warning badges next to it.

export const CLIENT_STATUS_TABS = ['all', 'onboarding', 'active', 'paused', 'churned'] as const;
export type ClientStatusTab = (typeof CLIENT_STATUS_TABS)[number];

const LABELS: Record<string, string> = {
  all: 'All',
  onboarding: 'Onboarding',
  active: 'Active',
  paused: 'Paused',
  churned: 'Churned',
  // Legacy value retired by migration 0022 — kept so a stray row still reads sensibly.
  prospect: 'Prospect',
};

// Statto pill variant per stored status.
const PILLS: Record<string, string> = {
  onboarding: 'infosoft',
  active: 'pos',
  paused: 'warn',
  churned: 'gray',
  prospect: 'infosoft',
};

export function clientStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function clientStatusPill(status: string): string {
  return PILLS[status] ?? 'gray';
}

/**
 * Things an ACTIVE client is missing, as short badge labels. Onboarding /
 * paused / churned clients get none — a missing agreement is expected there.
 * `documentsCount` is optional: pass it only when it was actually loaded, so
 * an unknown count never produces a false "No documents" badge.
 */
export function clientStatusWarnings(
  status: string,
  agreementSigned: boolean,
  documentsCount?: number,
): string[] {
  if (status !== 'active') return [];
  const out: string[] = [];
  if (!agreementSigned) out.push('No signed agreement');
  if (documentsCount === 0) out.push('No documents');
  return out;
}
