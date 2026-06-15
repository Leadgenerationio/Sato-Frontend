#!/usr/bin/env node
/*
 * Fidelity pass — align status pills / greys to the Statto mockup:
 *  - semantic tints `bg-X/10` → solid `-bg` tints (mockup .p-pos/.p-warn use --X-bg)
 *  - cool-grey Tailwind `neutral-*` → Statto neutral tokens (warm gray / muted)
 * These exact utility fragments only ever appear inside className strings.
 */
const fs = require('fs');
const path = require('path');

const MAP = {
  // semantic 10%-alpha tints → solid mockup tints
  'bg-positive/10': 'bg-positive-bg',
  'bg-negative/10': 'bg-negative-bg',
  'bg-warning/10': 'bg-warning-bg',
  'bg-info/10': 'bg-info-bg',
  // cool-grey neutral ramp → Statto tokens
  'bg-neutral-500/10': 'bg-muted',
  'bg-neutral-400/10': 'bg-muted',
  'bg-neutral-50': 'bg-muted',
  'bg-neutral-100': 'bg-muted',
  'bg-neutral-200': 'bg-secondary',
  'bg-neutral-400': 'bg-muted-foreground',
  'bg-neutral-500': 'bg-muted-foreground',
  'text-neutral-400': 'text-muted-foreground',
  'text-neutral-500': 'text-muted-foreground',
  'text-neutral-600': 'text-muted-foreground',
  'text-neutral-700': 'text-foreground',
  'text-neutral-800': 'text-foreground',
  'text-neutral-900': 'text-foreground',
  'border-neutral-200': 'border-border',
  'border-neutral-300': 'border-border',
};

// longest keys first so e.g. `bg-neutral-500/10` matches before `bg-neutral-500`
const keys = Object.keys(MAP).sort((a, b) => b.length - a.length);

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist', '__tests__'].includes(e.name)) continue;
      walk(full, acc);
    } else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) acc.push(full);
  }
  return acc;
}

const root = path.join(__dirname, '..', 'src');
let files = walk(root, []);
let changed = 0, total = 0;
const report = [];
for (const f of files) {
  let src = fs.readFileSync(f, 'utf8');
  let n = 0;
  for (const k of keys) {
    // match the token only at a className word boundary (preceded by space/quote/backtick, followed by space/quote/backtick)
    const re = new RegExp('(^|[\\s"\'`])' + k.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(?=[\\s"\'`])', 'g');
    src = src.replace(re, (m, pre) => { n++; return pre + MAP[k]; });
  }
  if (n > 0) { fs.writeFileSync(f, src); changed++; total += n; report.push(`${String(n).padStart(3)}  ${path.relative(root, f)}`); }
}
console.log(report.join('\n'));
console.log(`\n${total} replacements across ${changed} files`);
