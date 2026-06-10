# Stato Portal redesign — required backend changes

The client portal was restyled to the Statto design system (`Stato Portal.html`
handoff bundle). Most cards are wired to the **existing** portal API. This doc
lists the data the new design surfaces that the backend does **not** supply yet.
Anything not listed here is already covered by the current endpoints.

Cards currently rendering a **`sample`** flag (or an approximation) in the UI are
the ones blocked on the changes below — once the backend ships these fields, drop
the flag / approximation in the matching frontend component.

---

## 1. Dashboard — Ad Spend by Platform (`GET /api/v1/portal/dashboard`)

**Today:** `adSpendByPlatform: { platform, spend, currency }[]` — spend only.

The design's Ad Spend card shows **leads** and **cost-per-lead** per platform.
The frontend currently back-fills these from the `bySource` breakdown of
`GET /api/v1/portal/leads?from=<month-start>&to=<today>` (an extra request).
To make the dashboard self-contained, add per-platform leads to the dashboard
payload:

```ts
adSpendByPlatform?: {
  platform: string;
  spend: number;
  leads: number;     // NEW — valid leads MTD for this platform (LeadByte truth)
  currency: string;
}[];
```

CPL is derived FE-side (`spend / leads`). Keep `leads` consistent with the
`/portal/leads` `bySource` numbers (Sam's "no estimates" rule, jam-video #3).

## 2. Dashboard — headline stat deltas (`GET /api/v1/portal/dashboard`)

The design shows trend pills (e.g. "+18%") on the headline stats. The current
payload has no prior-period comparison, so the frontend omits the deltas. To
restore them, add month-over-month deltas:

```ts
deltas?: {
  leadsThisMonthPct?: number;     // vs last month, signed
  activeCampaignsPct?: number;
};
```

## 3. Dashboard — Account Manager card (`GET /api/v1/portal/dashboard`)

Optional "Account Manager" card (`support` block). No AM identity is exposed to
the portal today — the card renders with a `sample` flag. To make it real:

```ts
accountManager?: {
  name: string;
  responseSla?: string;   // e.g. "responds within 2 hours"
  phone?: string | null;  // omit/null to hide the Call button
  email?: string | null;  // omit/null to hide the Message button
} | null;
```

## 4. Dashboard — Lead Quality breakdown (optional)

The frontend's Lead Quality card uses **valid vs invalid** counts (already in the
`/portal/leads` daily rows) — this is real and needs no change. The original
design mock split leads into Qualified / Contacted / Rejected statuses. If that
status-level breakdown is wanted instead, expose per-status counts:

```ts
// On GET /api/v1/portal/leads response
leadStatusBreakdown?: { qualified: number; contacted: number; rejected: number; new: number };
```

## 5. Compliance — checks checklist (optional, NOT yet wired)

The design's Compliance screen also mocked a **regulatory checklist**
(TPS/CTPS screening, GDPR consent, data-processing agreement, ICO registration)
with cleared / action-needed states. The current `/api/v1/portal/compliance`
endpoint returns **creatives + landing pages** only, which the redesign keeps as
the primary content. The checklist was **not** ported (no data source). If the
business wants it, add an endpoint:

```ts
// GET /api/v1/portal/compliance-checks
{ checks: { key: string; label: string; detail: string; status: 'cleared' | 'action_needed'; lastRun?: string }[] }
```

---

## Notes

- No schema/breaking changes are required for the redesign to work — every field
  above is **additive and optional** on the wire, matching the existing
  Vercel-first deploy convention (FE ships before BE redeploys without
  TypeErrors).
- The frontend is defensive: missing fields fall back to approximations or a
  `sample` flag rather than crashing.
- All money stays real per Sam's rule — no estimated/derived spend figures are
  invented client-side; CPL is a pure `spend / leads` ratio of real values.
