import { describe, it, expect } from 'vitest';
import html from '../../index.html?raw';

// Retest R3 / N1: index.html still said "leadgeneration.io — Client portal", which link previews, bookmarks
// and the first paint pick up before the app loads.
describe('index.html', () => {
  it('names the product Stato in the static title and description', () => {
    expect(html).toMatch(/<title>Stato — Client portal<\/title>/);
    expect(html).toMatch(/for Stato clients\./);
    expect(html).not.toMatch(/leadgeneration/i);
  });
});

// Retest R3 / S15: a <button> inside a <Link> is two tab stops and nested interactive controls. A link that
// should look like a button carries the button classes itself.
describe('no link wraps a button', () => {
  const sources = import.meta.glob('/src/**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  it('finds no <Link …><button> in the app source', () => {
    const bad = Object.entries(sources).filter(([f, src]) => !f.includes('/__tests__/') && /<Link\b[^<>]*>\s*<button\b/.test(src)).map(([f]) => f);
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    expect(bad).toEqual([]);
  });
});
