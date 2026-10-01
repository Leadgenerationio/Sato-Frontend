import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Retest R3 / N1: index.html still said "leadgeneration.io — Client portal", which link previews, bookmarks
// and the first paint pick up before the app loads.
describe('index.html', () => {
  const html = readFileSync(join(__dirname, '../../index.html'), 'utf8');
  it('names the product Stato in the static title and description', () => {
    expect(html).toMatch(/<title>Stato — Client portal<\/title>/);
    expect(html).toMatch(/for Stato clients\./);
    expect(html).not.toMatch(/leadgeneration/i);
  });
});

// Retest R3 / S15: a <button> inside a <Link> is two tab stops and nested interactive controls. A link that
// should look like a button carries the button classes itself.
describe('no link wraps a button', () => {
  const files: string[] = [];
  const walk = (dir: string) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) { if (f !== '__tests__') walk(p); } else if (p.endsWith('.tsx')) files.push(p); } };
  walk(join(__dirname, '..'));
  it('finds no <Link …><button> in the app source', () => {
    const bad = files.filter((f) => /<Link\b[^<>]*>\s*<button\b/.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});
