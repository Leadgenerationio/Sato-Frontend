// Shared upload-day batching for the client portal. Introduced for the
// Compliance tab (FIX 3, 2026-06-15) and reused on the Creatives tab — the
// client asked for creatives to be presented in dated batches rather than one
// flat list. Grouping is purely a display concern: a batch = everything
// uploaded on the same local day. No batch entity exists server-side.

/** A dated batch of items grouped by their upload day. */
export interface Batch<T> {
  /** Day key (yyyy-mm-dd) used for stable sorting + React keys. */
  dayKey: string;
  /** Human header, e.g. "Monday 15 June 2026". */
  label: string;
  items: T[];
}

export function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  // Local-day bucket (yyyy-mm-dd) so items uploaded on the same day group together.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dayLabelOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Group items into dated batches by their upload day, newest day first.
 * `getIso` reads the upload timestamp off each item; insertion order within a
 * day is preserved (so a pre-sorted list keeps its order inside each batch).
 */
export function groupIntoBatches<T>(items: T[], getIso: (item: T) => string): Batch<T>[] {
  const map = new Map<string, Batch<T>>();
  for (const item of items) {
    const iso = getIso(item);
    const key = dayKeyOf(iso);
    let batch = map.get(key);
    if (!batch) {
      batch = { dayKey: key, label: dayLabelOf(iso), items: [] };
      map.set(key, batch);
    }
    batch.items.push(item);
  }
  // Newest day first.
  return Array.from(map.values()).sort((a, b) => (a.dayKey < b.dayKey ? 1 : a.dayKey > b.dayKey ? -1 : 0));
}
