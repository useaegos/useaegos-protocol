// Gate runner. Exit code 0 only if every gate passes. Usage: node scripts/verify.mjs
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname, extname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const walk = (d, acc = []) => {
  for (const n of readdirSync(d)) {
    const f = join(d, n);
    if (n === 'node_modules' || n === 'brand' || n === 'reference') continue;
    statSync(f).isDirectory() ? walk(f, acc) : acc.push(f);
  }
  return acc;
};

const results = [];
const gate = (name, fn) => {
  let ok = false, detail = '';
  try { const r = fn(); ok = r === true || r === undefined; detail = ok ? '' : String(r); } catch (e) { detail = e.message; }
  results.push({ name, ok, detail });
};

const srcFiles = walk(join(root, 'src')).filter((f) => /\.(html|css|js)$/.test(f));

gate('dist/index.html exists', () => existsSync(join(root, 'dist/index.html')));
gate('dist: brand logo copied (aegos-logo.png)', () => statSync(join(root, 'dist/assets/aegos-logo.png')).size > 10000);
gate('dist: lockup + mark + favicon present', () => ['aegos-lockup.png', 'aegos-mark.png', 'favicon.svg'].every((f) => existsSync(join(root, 'dist/assets', f))));
gate('index.html references logo files by relative path', () => {
  const h = read('dist/index.html');
  return ['./assets/aegos-lockup.png', './assets/aegos-mark.png', './assets/favicon.svg'].every((r) => h.includes(r)) || 'missing ref';
});
gate('index.html: no absolute-root asset paths', () => !/(?:src|href)="\/(?!\/)/.test(read('dist/index.html')) || 'root-absolute path found');
gate('favicon is SVG 32x32', () => /viewBox="0 0 32 32"/.test(read('src/assets/favicon.svg')) && /width="32" height="32"/.test(read('src/assets/favicon.svg')));
gate('palette: colour literals only in tokens.css', () => {
  const bad = [];
  for (const f of srcFiles) {
    if (f.endsWith('tokens.css')) continue;
    const t = readFileSync(f, 'utf8').replace(/&#\d+;/g, '');
    if (/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])|\brgba?\(\s*\d|\bhsla?\(/.test(t.replace(/href="#[a-z-]+"/g, '').replace(/url\(#/g, ''))) bad.push(relative(root, f));
  }
  return bad.length ? 'literals in ' + bad.join(', ') : true;
});
gate('no ch units', () => !srcFiles.some((f) => /\d\s?ch\b/.test(readFileSync(f, 'utf8').replace(/\bchain\b/g, ''))) || 'ch unit found');
gate('reduced-motion fallback present', () => /prefers-reduced-motion:\s*reduce/.test(read('src/css/main.css')) && /prefers-reduced-motion: reduce/.test(read('src/js/motion.js')));
gate('own row: accent border-left + animation + reduced-motion none', () => {
  const c = read('src/css/main.css');
  return /\.mrow\.own\{[^}]*border-left:2px solid var\(--color-accent\)/.test(c) && /\.mrow\.own\{animation:none\}/.test(c);
});

gate('no dates / timestamps in page copy', () => {
  const text = visibleText();
  const re = /\b(19|20)\d{2}\b|\b(january|february|march|april|june|july|august|september|october|november|december|jan|feb|apr|jun|jul|aug|sept?|oct|nov|dec)\b|\bas of\b|\bchecked\b|\bupdated\b|\b\d{1,2}:\d{2}\b|\byesterday\b|\btoday\b|\btoLocale(Date|Time)String\b/i;
  const m = text.match(re);
  const code = srcFiles.filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).join('\n');
  if (m) return 'found: ' + m[0];
  if (/new Date\(|Date\.now\(|toLocaleDateString|toLocaleTimeString|toISOString/.test(code)) return 'date API in js';
  return true;
});

gate('link rule: no hrefs to unstated socials', () => !/href="https?:\/\/(www\.)?(x\.com|twitter\.com|github\.com)/i.test(read('src/index.html')));
gate('social icons: both present, inert, official marks', () => {
  const h = read('src/index.html');
  return (h.match(/data-social="x"/g) || []).length === 1 && (h.match(/data-social="github"/g) || []).length === 1 &&
    h.includes('M18.244 2.25h3.308') && h.includes('M8 0c4.42 0 8 3.58 8 8a8.013') || 'icon missing';
});
gate('socials are inside the top-right cluster, icon only', () => {
  const h = read('src/index.html');
  const blk = h.slice(h.indexOf('class="socials"'), h.indexOf('data-anchor="ca-slot"'));
  return !/>[A-Za-z]{2,}</.test(blk.replace(/<svg[\s\S]*?<\/svg>/g, '')) || 'text label inside socials';
});

gate('CA slot anchors exist in both states (state-independent)', () => {
  const h = read('src/index.html');
  return ['ca-slot', 'ca-value', 'ca-copy', 'ca-hint', 'own-row'].every((a) => h.includes(`data-anchor="${a}"`));
});

gate('repo hygiene: no CLAUDE.md, .claude/, AI attribution', () => {
  if (existsSync(join(root, 'CLAUDE.md')) || existsSync(join(root, '.claude'))) return 'forbidden path';
  const bad = walk(root).filter((f) => !f.includes('dist') && !f.endsWith('.png') && !f.endsWith('ref-bigrams.json') && !f.endsWith('verify.mjs'))
    .filter((f) => /co-authored-by|generated (with|by)|\bclaude\b|\banthropic\b|\bchatgpt\b|\bopenai\b/i.test(readFileSync(f, 'utf8')));
  return bad.length ? 'attribution in ' + bad.map((b) => relative(root, b)).join(', ') : true;
});
gate('repo docs present (README, whitepaper, MIT LICENSE)', () =>
  existsSync(join(root, 'README.md')) && existsSync(join(root, 'docs/whitepaper.md')) && /MIT License/.test(read('LICENSE')) && /AEGOS, 2026/.test(read('LICENSE')));

gate('no shared 2-grams with reference copy', () => {
  const ref = new Set(JSON.parse(read('scripts/ref-bigrams.json')));
  const w = visibleText().toLowerCase().match(/[a-z0-9]+/g) || [];
  const shared = new Set();
  for (let i = 0; i < w.length - 1; i++) if (ref.has(w[i] + ' ' + w[i + 1])) shared.add(w[i] + ' ' + w[i + 1]);
  return shared.size ? [...shared].join(' | ') : true;
});

gate('every @keyframes is applied to an element', () => {
  const css = read('src/css/main.css');
  const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
  const unused = names.filter((n) => !new RegExp('animation:[^;}]*\\b' + n + '\\b').test(css));
  return unused.length ? 'unused: ' + unused.join(', ') : true;
});
gate('reduced-motion kills every animation and transition', () =>
  /@media \(prefers-reduced-motion:reduce\)\{[^@]*\*,\*::before,\*::after\{animation:none!important;transition:none!important\}/.test(read('src/css/main.css').replace(/\n/g, '')));
gate('motion values match reference (reveal .15/-8%/90ms, count-up 1100ms, tabs 2600/3000, copy 1600)', () => {
  const m = read('src/js/motion.js'), k = read('src/js/main.js');
  return (/threshold: 0\.15, rootMargin: '0px 0px -8% 0px'/.test(m) && /idx \* 90/.test(m) && /\/ 1100/.test(m) && /Math\.pow\(1 - r, 3\)/.test(m) &&
    /2600\)/.test(k) && /3000\)/.test(k) && /threshold: 0\.25/.test(k) && /1600\)/.test(k) && /scrollY > 12/.test(k)) || 'mismatch';
});
gate('hero entrance values match reference (rise 1.05s, fade-up .9s, header-in .5s, delays)', () => {
  const c = read('src/css/main.css');
  return /animation:rise 1\.05s var\(--ease-out\) both;animation-delay:calc\(var\(--i,0\)\*\.11s \+ \.12s\)/.test(c) &&
    /animation:fade-up \.9s var\(--ease-out\) both;animation-delay:calc\(var\(--i,0\)\*90ms \+ \.38s\)/.test(c) &&
    /animation:header-in \.5s var\(--ease-out\) both/.test(c) && /--ease-out: cubic-bezier\(\.2, \.75, \.1, 1\)/.test(read('src/css/tokens.css')) || 'mismatch';
});
gate('nav carries two inert socials with no href, logo images have src', () => {
  const h = read('src/index.html');
  const blk = h.slice(h.indexOf('class="socials"'), h.indexOf('data-anchor="ca-slot"'));
  return !/href=/.test(blk) && (blk.match(/class="soc"/g) || []).length === 2 && /<img src="\.\/assets\/aegos-lockup\.png"/.test(h) || 'bad';
});

// Register + gate logic, exercised directly.
const { REGISTER, statedCA, hrefOf, handleOf } = await import(pathToFileURL(join(root, 'src/js/register.js')).href);
const { scanAddresses } = await import(pathToFileURL(join(root, 'src/js/gate.js')).href);
gate('register: ca/x/github are absent in source', () => REGISTER.ca.state === 'absent' && REGISTER.x.state === 'absent' && REGISTER.github.state === 'absent');
gate('register: unstated records yield no CA/href/handle', () => statedCA() === null && hrefOf(REGISTER.x) === null && handleOf(REGISTER.github) === null);
gate('register: unconfirmed renders inert', () => statedCA({ ca: { state: 'unconfirmed', value: 'So11111111111111111111111111111111111111112' } }) === null);
gate('register: link rule derives handle from stored URL', () => handleOf({ state: 'stated', url: 'https://x.com/aegos' }) === '@aegos');
gate('gate: 0x hex is not blanket-rejected (flagged only when unregistered)', () => {
  const evm = '0x' + 'ab'.repeat(20);
  const hit = scanAddresses('see ' + evm).includes(evm);
  const reg = { ca: { state: 'stated', value: 'So11111111111111111111111111111111111111112' } };
  const exempt = scanAddresses('CA So11111111111111111111111111111111111111112', reg).length === 0;
  const unstatedCaNotExempt = scanAddresses('So11111111111111111111111111111111111111112').length === 1;
  return (hit && exempt && unstatedCaNotExempt) || `hit=${hit} exempt=${exempt} notExempt=${unstatedCaNotExempt}`;
});
gate('market: no CA reference gates the trending fetch', () => {
  const m = read('src/js/market.js');
  const fn = m.slice(m.indexOf('async function loadTrending'), m.indexOf('async function loadOwn'));
  return !/statedCA|REGISTER\.ca/.test(fn) || 'trending depends on CA';
});
gate('market: pump.fun and DexScreener fetched in parallel for own token', () => {
  const m = read('src/js/market.js');
  return /const dexP = getJSON/.test(m) && /const pumpP =/.test(m) && /Promise\.allSettled\(\[dexP, pumpP\]\)/.test(m);
});
gate('market: backoff, visibility pause, 60s poll', () => {
  const m = read('src/js/market.js');
  return /POLL_MS = 60_000/.test(m) && /2 \*\* \(fails - 1\)/.test(m) && /document\.hidden/.test(m) && /visibilitychange/.test(m);
});
gate('stated branch build carries a stated CA record', () => {
  const p = join(root, 'dist-stated/js/register.js');
  return !existsSync(p) || /ca: \{ state: 'stated'/.test(readFileSync(p, 'utf8')) || 'dist-stated has no stated CA';
});

function visibleText() {
  const html = read('src/index.html').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
  const attrs = [...html.matchAll(/(?:alt|aria-label|content)="([^"]+)"/g)].map((m) => m[1]);
  const body = html.replace(/<[^>]+>/g, ' zzbreak ');
  const js = ['main.js', 'market.js'].map((f) => [...read('src/js/' + f).matchAll(/'([A-Z][^'\n]{2,60})'/g)].map((m) => m[1]).join(' zzbreak ')).join(' zzbreak ');
  return (body + ' ' + attrs.join(' zzbreak ') + ' ' + js).replace(/&[a-z#0-9]+;/g, ' ');
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.detail ? '  -> ' + r.detail : ''));
}
console.log(`\n${results.length - failed}/${results.length} gates passed`);
process.exit(failed ? 1 : 0);
