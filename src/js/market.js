// MARKET — live board + ticker. Follows the marketSource record only; CA state never gates it.
// Own-token row #1 is the only CA-dependent piece, and it never blocks (or is blocked by) trending.
import { REGISTER, statedCA, isStated } from './register.js';
import { countTo, reduced } from './motion.js';

const MARK = './assets/aegos-mark.png';
const POLL_MS = 60_000;
const TOP_N = 10;
const BOARD_ROWS = 9; // ranks 2..10 under the pinned own row

const board = document.getElementById('board-body');
const note = document.getElementById('board-note');
const track = document.getElementById('ticker-track');
const pill = document.getElementById('status-pill');
const pillText = document.getElementById('status-text');
const slotEl = document.getElementById('net-slot');

const trendingRows = new Map(); // address -> row element
let trending = []; // parsed items, rank order
let own = null; // parsed own item (or null)
let everLoaded = false;
let fails = 0;
let timer = 0;
let inflight = false;
let ownRow;

/* ---------- formatting ---------- */
const DASH = '—';
export function fmtPrice(n) {
  if (!Number.isFinite(n)) return DASH;
  if (n >= 1) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (n === 0) return '$0.00';
  const dec = Math.min(12, Math.max(2, 3 - Math.floor(Math.log10(n))));
  return '$' + n.toFixed(dec);
}
export function fmtUsd(n) {
  if (!Number.isFinite(n)) return DASH;
  const a = Math.abs(n);
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
}
export function fmtPct(n) {
  if (!Number.isFinite(n)) return DASH;
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
}

/* ---------- network ---------- */
async function getJSON(url, ms = 10_000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));

function parsePair(p, fallbackImg) {
  if (!p || !p.baseToken) return null;
  return {
    address: p.baseToken.address,
    symbol: p.baseToken.symbol || '?',
    name: p.baseToken.name || '',
    img: (p.info && p.info.imageUrl) || fallbackImg || null,
    price: num(p.priceUsd),
    ch: num(p.priceChange && p.priceChange.h24),
    vol: num(p.volume && p.volume.h24),
    liq: num(p.liquidity && p.liquidity.usd),
    url: p.url || null,
  };
}
const bestPair = (pairs) =>
  (Array.isArray(pairs) ? pairs : []).slice().sort((a, b) => num(b.volume && b.volume.h24) - num(a.volume && a.volume.h24) || 0)[0] || null;

async function loadTrending() {
  const src = REGISTER.marketSource;
  if (!isStated(src)) throw new Error('market source not stated');
  const boosts = await getJSON(src.boosts);
  const list = (Array.isArray(boosts) ? boosts : [])
    .filter((b) => b && b.chainId === 'solana' && b.tokenAddress)
    .sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0));
  const seen = new Set();
  const top = list.filter((b) => (seen.has(b.tokenAddress) ? false : seen.add(b.tokenAddress))).slice(0, TOP_N);
  const results = await Promise.allSettled(
    top.map(async (b) => {
      const pairs = await getJSON(src.tokens + b.tokenAddress);
      const pair = bestPair(pairs);
      const boostIcon = typeof b.icon === 'string' && /^https?:/.test(b.icon) ? b.icon : null;
      return parsePair(pair, boostIcon);
    }),
  );
  const items = results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
  if (!items.length) throw new Error('no trending data');
  return items;
}

async function loadOwn(ca) {
  // DexScreener and pump.fun run side by side; neither awaits the other.
  const dexP = getJSON(REGISTER.marketSource.pairsByToken + ca);
  const pumpP = isStated(REGISTER.pumpSource) ? getJSON(REGISTER.pumpSource.coin + ca) : Promise.reject(new Error('pump not stated'));
  const [dex, pump] = await Promise.allSettled([dexP, pumpP]);
  const pump_ = pump.status === 'fulfilled' ? pump.value : null;
  const pair = dex.status === 'fulfilled' ? bestPair(dex.value && dex.value.pairs) : null;
  if (!pair && !pump_) throw new Error('own token unavailable');
  const item = pair ? parsePair(pair) : { address: ca, symbol: 'AEGOS', name: 'Aegos', img: null, price: NaN, ch: NaN, vol: NaN, liq: NaN, url: null };
  item.address = ca;
  item.imgs = [pump_ && pump_.image_uri, item.img, MARK].filter(Boolean);
  if (pump_ && !item.name) item.name = pump_.name || '';
  if (pump_ && (!item.symbol || item.symbol === '?')) item.symbol = pump_.symbol || item.symbol;
  return item;
}

async function loadSlot() {
  try {
    const r = await fetch(REGISTER.chain.rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSlot', params: [{ commitment: 'confirmed' }] }),
    });
    const j = await r.json();
    if (slotEl && Number.isFinite(j.result)) countTo(slotEl, j.result, (v) => Math.round(v).toLocaleString('en-US'), false);
  } catch {
    if (slotEl) slotEl.textContent = DASH;
  }
}

/* ---------- DOM ---------- */
function tile(item, imgs) {
  const t = document.createElement('span');
  t.className = 'tile';
  const letter = (item.symbol || '?').trim().charAt(0).toUpperCase() || '?';
  const showLetter = () => {
    t.textContent = '';
    t.classList.add('tile-letter');
    t.textContent = letter;
  };
  const queue = (imgs || [item.img]).filter(Boolean);
  const tryNext = () => {
    const src = queue.shift();
    if (!src) return showLetter();
    const im = new Image();
    im.alt = '';
    im.decoding = 'async';
    im.referrerPolicy = 'no-referrer';
    im.onload = () => { t.textContent = ''; t.classList.remove('tile-letter'); t.appendChild(im); };
    im.onerror = tryNext;
    im.src = src;
  };
  showLetter();
  tryNext();
  return t;
}

const cell = (cls, text = '') => {
  const d = document.createElement('div');
  d.className = 'c ' + cls;
  d.textContent = text;
  return d;
};

function buildRow(item, rank) {
  const row = document.createElement('div');
  row.className = 'mrow';
  row.setAttribute('role', 'row');
  row.dataset.spot = '';
  const rk = cell('c-rank', String(rank));
  const tk = cell('c-token');
  tk.appendChild(tile(item));
  const names = document.createElement('div');
  names.className = 'names';
  names.innerHTML = '<b class="sym"></b><span class="nm"></span>';
  tk.appendChild(names);
  const price = cell('c-price num'); price.dataset.k = 'price';
  const ch = cell('c-ch num'); ch.dataset.k = 'ch';
  const vol = cell('c-vol num'); vol.dataset.k = 'vol';
  const liq = cell('c-liq num'); liq.dataset.k = 'liq';
  [price, ch, vol, liq].forEach((c) => c.setAttribute('data-label', ({ price: 'Price', ch: '24h', vol: 'Volume', liq: 'Liquidity' })[c.dataset.k]));
  row.append(rk, tk, price, ch, vol, liq);
  return row;
}

function fill(row, item, rank) {
  row.querySelector('.c-rank').textContent = String(rank);
  row.querySelector('.sym').textContent = item.symbol;
  row.querySelector('.nm').textContent = item.name;
  countTo(row.querySelector('[data-k=price]'), item.price, fmtPrice);
  const ch = row.querySelector('[data-k=ch]');
  countTo(ch, item.ch, fmtPct, false);
  ch.classList.toggle('up', item.ch > 0);
  ch.classList.toggle('down', item.ch < 0);
  countTo(row.querySelector('[data-k=vol]'), item.vol, fmtUsd);
  countTo(row.querySelector('[data-k=liq]'), item.liq, fmtUsd);
  let hit = row.querySelector('.row-hit');
  if (item.url && /^https:\/\//.test(item.url)) {
    if (!hit) {
      hit = document.createElement('a');
      hit.className = 'row-hit';
      hit.target = '_blank';
      hit.rel = 'noopener noreferrer';
      row.appendChild(hit);
    }
    hit.href = item.url;
    hit.setAttribute('aria-label', item.symbol + ' on DexScreener');
  } else if (hit) hit.remove();
}

function renderOwn() {
  ownRow.dataset.ownState = own ? 'stated' : statedCA() ? 'loading' : 'absent';
  if (!statedCA()) return; // placeholder stays as authored in HTML
  if (!own) return;
  if (!ownRow.dataset.built) {
    ownRow.dataset.built = '1';
    ownRow.querySelector('.c-token').replaceChildren(tile(own, own.imgs));
    const names = document.createElement('div');
    names.className = 'names';
    names.innerHTML = '<b class="sym"></b><span class="nm"></span>';
    ownRow.querySelector('.c-token').appendChild(names);
    ownRow.querySelector('.ph').replaceWith(...['price', 'ch', 'vol', 'liq'].map((k) => {
      const c = cell('c-' + k + ' num');
      c.dataset.k = k;
      c.setAttribute('data-label', ({ price: 'Price', ch: '24h', vol: 'Volume', liq: 'Liquidity' })[k]);
      return c;
    }));
  }
  fill(ownRow, own, 1);
}

function renderTrending() {
  const ca = statedCA();
  const rows = trending.filter((t) => t.address !== ca).slice(0, BOARD_ROWS); // dedup against own
  const keep = new Set(rows.map((r) => r.address));
  [...trendingRows].forEach(([k, el]) => { if (!keep.has(k)) { el.remove(); trendingRows.delete(k); } });
  board.querySelectorAll('.mrow.skel').forEach((s) => s.remove());
  rows.forEach((item, i) => {
    let el = trendingRows.get(item.address);
    const fresh = !el;
    if (fresh) {
      el = buildRow(item, i + 2);
      el.style.setProperty('--i', String(i));
      el.classList.add('row-enter');
      trendingRows.set(item.address, el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('row-in')));
    }
    fill(el, item, i + 2);
    board.appendChild(el); // appendChild re-orders existing nodes
  });
}

function renderTicker() {
  const ca = statedCA();
  const all = [...(own ? [own] : []), ...trending.filter((t) => t.address !== ca)];
  if (!all.length) return;
  const key = all.map((a) => a.address).join('|');
  if (track.dataset.key !== key) {
    track.dataset.key = key;
    const mk = (item) => {
      const li = document.createElement('li');
      li.className = 'tk';
      li.dataset.a = item.address;
      li.innerHTML = '<span class="tk-s"></span><span class="tk-p"></span><span class="tk-c"></span>';
      return li;
    };
    track.replaceChildren(...all.map(mk), ...all.map((i) => { const l = mk(i); l.setAttribute('aria-hidden', 'true'); return l; }));
  }
  track.querySelectorAll('.tk').forEach((li) => {
    const it = all.find((a) => a.address === li.dataset.a);
    if (!it) return;
    li.querySelector('.tk-s').textContent = it.symbol;
    li.querySelector('.tk-p').textContent = fmtPrice(it.price);
    const c = li.querySelector('.tk-c');
    c.textContent = fmtPct(it.ch);
    c.className = 'tk-c ' + (it.ch > 0 ? 'up' : it.ch < 0 ? 'down' : '');
  });
  track.closest('.ticker').classList.add('ready');
}

function setStatus(kind) {
  pill.dataset.state = kind;
  pillText.textContent = kind === 'live' ? 'Feed live' : kind === 'retry' ? 'Feed retrying' : 'Connecting';
}

function showError(msg) {
  note.hidden = false;
  note.textContent = msg;
}

/* ---------- loop ---------- */
async function tick() {
  if (inflight) return;
  inflight = true;
  clearTimeout(timer);
  const ca = statedCA();
  const jobs = [];
  jobs.push(
    loadTrending().then(
      (items) => { trending = items; fails = 0; everLoaded = true; note.hidden = true; setStatus('live'); renderTrending(); renderTicker(); },
      () => {
        fails++;
        setStatus('retry');
        if (!everLoaded) {
          showError('Market feed did not answer. Trying again shortly.');
          board.querySelectorAll('.mrow.skel').forEach((s) => s.classList.add('skel-err'));
        } else showError('Feed is retrying. Showing the last good reading.');
      },
    ),
  );
  if (ca) {
    jobs.push(loadOwn(ca).then((o) => { own = o; renderOwn(); renderTicker(); }, () => { /* keep last good */ }));
  }
  jobs.push(loadSlot());
  await Promise.allSettled(jobs);
  inflight = false;
  schedule();
}

function schedule() {
  clearTimeout(timer);
  if (document.hidden) return;
  const wait = fails ? Math.min(POLL_MS, 2000 * 2 ** (fails - 1)) : POLL_MS; // exponential backoff
  timer = setTimeout(tick, wait);
}

export function initMarket() {
  ownRow = document.getElementById('own-row');
  setStatus('connecting');
  renderOwn();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else tick(); // immediate fetch when the tab shows again
  });
  tick();
}
