import { REGISTER, statedCA, hrefOf, handleOf } from './register.js';
import { runGate } from './gate.js';
import { initReveal, initParallax, initProgress, initSpotlight, reduced } from './motion.js';
import { initMarket } from './market.js';

document.documentElement.classList.add('js');
{ // browser chrome colour follows the paper token, not a literal
  const m = document.createElement('meta');
  m.name = 'theme-color';
  m.content = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
  document.head.appendChild(m);
}

/* ---- CA slot: state-independent anchors, reads the record at runtime ---- */
function initCA() {
  const ca = statedCA();
  const slot = document.querySelector('[data-anchor="ca-slot"]');
  const value = document.querySelector('[data-anchor="ca-value"]');
  const btn = document.querySelector('[data-anchor="ca-copy"]');
  const hint = document.querySelector('[data-anchor="ca-hint"]');
  document.documentElement.dataset.caState = ca ? 'stated' : REGISTER.ca.state;
  slot.dataset.state = ca ? 'stated' : 'inert';
  if (!ca) {
    value.textContent = '· · · · · · · · · · · · · · · ·';
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    hint.textContent = 'Not announced';
    return;
  }
  value.textContent = ca;
  btn.disabled = false;
  btn.removeAttribute('aria-disabled');
  hint.textContent = 'Tap to copy';
  let t = 0;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(ca);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = ca;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* nothing else to try */ }
      ta.remove();
    }
    slot.classList.add('copied');
    hint.textContent = 'Copied';
    clearTimeout(t);
    t = setTimeout(() => { slot.classList.remove('copied'); hint.textContent = 'Tap to copy'; }, 1600);
  });
}

/* ---- Socials: link rule. Stated => anchor with derived handle; otherwise inert span ---- */
function initSocials() {
  document.querySelectorAll('[data-social]').forEach((el) => {
    const rec = REGISTER[el.dataset.social];
    const href = hrefOf(rec);
    const label = el.dataset.label;
    if (!href) {
      el.removeAttribute('href');
      el.setAttribute('aria-disabled', 'true');
      el.removeAttribute('title');
      el.setAttribute('aria-label', label + ' (not announced)');
      el.setAttribute('role', 'img');
      el.classList.add('inert');
      return;
    }
    const a = document.createElement('a');
    a.className = el.className;
    a.innerHTML = el.innerHTML;
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.dataset.social = el.dataset.social;
    a.setAttribute('aria-label', label + ' ' + (handleOf(rec) || ''));
    el.replaceWith(a);
  });
}

/* ---- Pipeline tabs: auto-advance every 2600ms while in view; a manual pick pauses it 3000ms (reference behaviour) ---- */
function initTabs() {
  const tabs = [...document.querySelectorAll('[role=tab]')];
  const panels = [...document.querySelectorAll('[role=tabpanel]')];
  const host = document.querySelector('.tabs');
  let cur = 0, inView = false, paused = false, timer = 0, resume = 0;
  const select = (i, focus) => {
    cur = i;
    tabs.forEach((t, k) => {
      t.setAttribute('aria-selected', String(k === i));
      t.tabIndex = k === i ? 0 : -1;
    });
    panels.forEach((p, k) => { p.hidden = k !== i; });
    if (focus) tabs[i].focus();
  };
  const arm = () => {
    clearTimeout(timer);
    if (reduced() || !inView || paused) return;
    timer = setTimeout(() => { select((cur + 1) % tabs.length); arm(); }, 2600);
  };
  const user = (i, focus) => {
    select(i, focus);
    paused = true;
    clearTimeout(resume);
    resume = setTimeout(() => { paused = false; arm(); }, 3000);
    arm();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => user(i));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') user((i + 1) % tabs.length, true);
      if (e.key === 'ArrowLeft') user((i - 1 + tabs.length) % tabs.length, true);
    });
  });
  select(0);
  if (host && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; arm(); }, { threshold: 0.25 }).observe(host);
  }
}

/* ---- Header: border + paper wash appear after 12px of scroll (reference), 300ms colour transition ---- */
function initHeader() {
  const h = document.getElementById('top');
  const upd = () => h.classList.toggle('scrolled', scrollY > 12);
  addEventListener('scroll', upd, { passive: true });
  upd();
}

initCA();
initSocials();
initTabs();
initHeader();
initProgress();
initSpotlight();
initParallax();
initReveal();
runGate();
initMarket();
