#!/usr/bin/env node
/*
 * Statto restyle codemod — maps off-brand Tailwind color utilities to Statto
 * semantic tokens. UI-only: only rewrites color *utility class fragments*
 * (e.g. `bg-blue-500/10`), which only ever occur inside className strings.
 * Neutral grays (gray/slate/zinc/neutral/stone) are intentionally left alone.
 *
 * Hue → meaning → token:
 *   blue/sky/indigo/cyan      → info
 *   emerald/teal/green        → positive
 *   red/rose                  → negative
 *   amber/yellow/orange       → warning
 *   violet/purple/fuchsia/pink→ brand lime accent (lime-50/400/600 scale)
 */
const fs = require('fs');
const path = require('path');

const HUE_GROUP = {
  blue: 'info', sky: 'info', indigo: 'info', cyan: 'info',
  emerald: 'positive', teal: 'positive', green: 'positive',
  red: 'negative', rose: 'negative',
  amber: 'warning', yellow: 'warning', orange: 'warning',
  violet: 'brand', purple: 'brand', fuchsia: 'brand', pink: 'brand',
};
const HUES = Object.keys(HUE_GROUP).join('|');
const PREFIXES = 'bg|text|border|ring|from|to|via|fill|stroke|decoration|outline|ring-offset|divide|shadow|accent|caret';
const RE = new RegExp(`\\b(${PREFIXES})-(${HUES})-(\\d{2,3})(?:/(\\d{1,3}))?\\b`, 'g');

function mapToken(prefix, group, shade, op) {
  const shadeNum = parseInt(shade, 10);
  if (group === 'brand') {
    let base;
    if (['text', 'fill', 'stroke', 'decoration', 'caret', 'accent'].includes(prefix)) base = 'lime-600';
    else if (prefix === 'bg') base = shadeNum <= 100 ? 'lime-50' : 'lime-400';
    else if (prefix === 'border' || prefix === 'ring' || prefix === 'divide' || prefix === 'outline' || prefix === 'ring-offset') base = 'lime-300';
    else base = shadeNum <= 100 ? 'lime-100' : 'lime-400'; // gradients
    return `${prefix}-${base}${op ? '/' + op : ''}`;
  }
  // single-color semantic token (info/positive/negative/warning)
  const token = group;
  if (op) return `${prefix}-${token}/${op}`;
  if (['text', 'fill', 'stroke', 'decoration', 'caret', 'accent', 'from', 'to', 'via', 'shadow'].includes(prefix)) {
    return `${prefix}-${token}`;
  }
  if (prefix === 'bg') return shadeNum <= 100 ? `bg-${token}/10` : `bg-${token}`;
  if (prefix === 'border' || prefix === 'divide' || prefix === 'outline') return `${prefix}-${token}/30`;
  if (prefix === 'ring' || prefix === 'ring-offset') return `${prefix}-${token}/30`;
  return `${prefix}-${token}`;
}

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '__tests__') continue;
      walk(full, acc);
    } else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const root = path.join(__dirname, '..', 'src');
const files = walk(root, []);
let changedFiles = 0, totalRepl = 0;
const report = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let n = 0;
  const out = src.replace(RE, (m, prefix, hue, shade, op) => {
    n++;
    return mapToken(prefix, HUE_GROUP[hue], shade, op);
  });
  if (n > 0) {
    fs.writeFileSync(f, out);
    changedFiles++; totalRepl += n;
    report.push(`${String(n).padStart(3)}  ${path.relative(root, f)}`);
  }
}
console.log(report.join('\n'));
console.log(`\n${totalRepl} replacements across ${changedFiles} files`);
