// GATE WARNING — address-shaped strings are matched against the stated registry.
// Hex (0x…) strings are never blanket-rejected; they are only flagged if they match no stated record.
// The stated CA is exempt from the scanner.
import { REGISTER, statedCA } from './register.js';

const SHAPES = [
  /\b0x[0-9a-fA-F]{40}\b/g, // EVM-shaped
  /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, // base58-shaped
];

export function stateRegistry(reg = REGISTER) {
  const set = new Set();
  const ca = statedCA(reg);
  if (ca) set.add(ca);
  return set;
}

/** Returns address-shaped strings found in `text` that are not in the stated registry. */
export function scanAddresses(text, reg = REGISTER) {
  const known = stateRegistry(reg);
  const hits = [];
  for (const re of SHAPES) {
    for (const m of text.matchAll(re)) {
      if (known.has(m[0])) continue; // CA exempt
      if (/^[a-z]+$/i.test(m[0]) && !/\d/.test(m[0])) continue; // plain words are not addresses
      hits.push(m[0]);
    }
  }
  return hits;
}

/** Runtime check over regions that carry editorial copy. Warns; never throws, never rejects. */
export function runGate(root = document) {
  const warnings = [];
  root.querySelectorAll('[data-copy]').forEach((el) => {
    scanAddresses(el.textContent || '').forEach((a) => warnings.push(a));
  });
  if (warnings.length) console.warn('[aegos gate] unregistered address-shaped strings:', warnings);
  document.documentElement.dataset.gateWarnings = String(warnings.length);
  return warnings;
}
