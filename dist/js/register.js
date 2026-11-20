// REGISTER — every external fact is exactly one record.
// state: "stated" | "absent" | "unconfirmed". Only "stated" may render live; the rest render inert.
// build.mjs may rewrite the `ca` record (AEGOS_CA env) into a throw-away output for branch proofs.

export const REGISTER = {
  ca: { state: 'absent', value: null },
  x: { state: 'absent', url: null },
  github: { state: 'absent', url: null },
  chain: { state: 'stated', name: 'Solana', cluster: 'mainnet', rpc: 'https://solana-rpc.publicnode.com' },
  marketSource: {
    state: 'stated',
    boosts: 'https://api.dexscreener.com/token-boosts/top/v1',
    tokens: 'https://api.dexscreener.com/tokens/v1/solana/',
    pairsByToken: 'https://api.dexscreener.com/latest/dex/tokens/',
  },
  pumpSource: { state: 'stated', coin: 'https://frontend-api.pump.fun/coins/' },
  domain: { state: 'stated', value: 'aegos.online' },
};

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isStated(rec) {
  return !!rec && rec.state === 'stated';
}

/** The CA only counts as stated when the record says so AND the value has Solana address shape. */
export function statedCA(reg = REGISTER) {
  const r = reg.ca;
  return isStated(r) && typeof r.value === 'string' && BASE58.test(r.value) ? r.value : null;
}

/** Link rule: URL is stored, handle is derived. No href for anything not stated. */
export function hrefOf(rec) {
  return isStated(rec) && typeof rec.url === 'string' && /^https:\/\//.test(rec.url) ? rec.url : null;
}
export function handleOf(rec) {
  const u = hrefOf(rec);
  if (!u) return null;
  try {
    const seg = new URL(u).pathname.split('/').filter(Boolean)[0];
    return seg ? '@' + seg : null;
  } catch {
    return null;
  }
}
