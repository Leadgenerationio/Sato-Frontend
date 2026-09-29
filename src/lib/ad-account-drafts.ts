import type { AdAccountLinkInput, AdAccountRow } from '@/lib/hooks/use-ad-accounts';

// Draft edits on the "Link ad accounts" screen (Sam S13). Nothing is saved
// until Save; these helpers turn the drafts into exactly the rows that
// changed, so a save never rewrites links nobody touched.

export interface LinkDraft {
  clientId: string | null;
  campaignId: string | null;
}

export const accountKey = (a: Pick<AdAccountRow, 'platform' | 'accountId'>) => `${a.platform}|${a.accountId}`;

/** The link as currently saved on the server. */
export function savedDraft(a: AdAccountRow): LinkDraft {
  return { clientId: a.link?.clientId ?? null, campaignId: a.link?.campaignId ?? null };
}

/** The value the screen should show: the draft if there is one, else saved. */
export function effectiveDraft(a: AdAccountRow, drafts: ReadonlyMap<string, LinkDraft>): LinkDraft {
  return drafts.get(accountKey(a)) ?? savedDraft(a);
}

export function isChanged(a: AdAccountRow, drafts: ReadonlyMap<string, LinkDraft>): boolean {
  const d = drafts.get(accountKey(a));
  if (!d) return false;
  const s = savedDraft(a);
  return d.clientId !== s.clientId || d.campaignId !== s.campaignId;
}

/** Only the rows whose draft differs from what's saved, as API input. */
export function buildLinkChanges(
  accounts: readonly AdAccountRow[],
  drafts: ReadonlyMap<string, LinkDraft>,
): AdAccountLinkInput[] {
  const out: AdAccountLinkInput[] = [];
  for (const a of accounts) {
    if (!isChanged(a, drafts)) continue;
    const d = drafts.get(accountKey(a))!;
    out.push({
      platform: a.platform,
      accountId: a.accountId,
      clientId: d.clientId,
      // A campaign without a client isn't a valid link — clearing the client
      // clears the campaign too.
      campaignId: d.clientId ? d.campaignId : null,
      accountName: a.accountName,
      currency: a.currency,
    });
  }
  return out;
}

/** Set the same client on many rows (bulk "Assign client"). Keeps each row's
 *  campaign when the client is unchanged, otherwise clears it. */
export function assignClient(
  drafts: ReadonlyMap<string, LinkDraft>,
  rows: readonly AdAccountRow[],
  clientId: string | null,
): Map<string, LinkDraft> {
  const next = new Map(drafts);
  for (const a of rows) {
    const cur = effectiveDraft(a, drafts);
    next.set(accountKey(a), {
      clientId,
      campaignId: clientId && cur.clientId === clientId ? cur.campaignId : null,
    });
  }
  return next;
}

/** Spend per currency for a set of rows — £ and € are never added together. */
export function spendByCurrency(rows: readonly AdAccountRow[]): Array<{ currency: string; spend: number }> {
  const m = new Map<string, number>();
  for (const a of rows) {
    if (a.spend <= 0) continue;
    const cur = a.currency ?? 'GBP';
    m.set(cur, (m.get(cur) ?? 0) + a.spend);
  }
  return [...m.entries()]
    .map(([currency, spend]) => ({ currency, spend: Math.round(spend * 100) / 100 }))
    .sort((x, y) => y.spend - x.spend);
}
