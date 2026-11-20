// MOTION — damped-spring solver, scroll reveal, hero parallax, progress bar, count-up.
// Every animation here has an instant fallback under prefers-reduced-motion.

const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
export const reduced = () => mq.matches;

/** Damped harmonic oscillator, semi-implicit Euler, sub-stepped. Resolves when at rest. */
export function spring({ from = 0, to = 1, stiffness = 170, damping = 22, mass = 1, onUpdate, onDone }) {
  if (reduced()) {
    onUpdate(to);
    onDone && onDone();
    return () => {};
  }
  let x = from;
  let v = 0;
  let last = performance.now();
  let raf = 0;
  let dead = false;
  const tick = (now) => {
    if (dead) return;
    let dt = Math.min((now - last) / 1000, 0.032);
    last = now;
    const steps = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = (-stiffness * (x - to) - damping * v) / mass;
      v += a * h;
      x += v * h;
    }
    onUpdate(x);
    if (Math.abs(x - to) < 0.0005 && Math.abs(v) < 0.0005) {
      dead = true;
      clearTimeout(wd);
      onUpdate(to);
      onDone && onDone();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  // Watchdog: a throttled/background tab may starve rAF; settle on the target regardless.
  const wd = setTimeout(() => {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    onUpdate(to);
    onDone && onDone();
  }, 2600);
  return () => {
    dead = true;
    clearTimeout(wd);
    cancelAnimationFrame(raf);
  };
}

/** Scroll-reveal with per-group stagger. Elements: [data-reveal]; group index from --i or sibling order. */
export function initReveal(root = document) {
  const els = [...root.querySelectorAll('[data-reveal]')];
  if (reduced() || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-revealed'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const el = e.target;
        const idx = Number(el.style.getPropertyValue('--i')) || [...(el.parentElement?.children || [])].indexOf(el);
        setTimeout(() => {
          spring({
            from: 0,
            to: 1,
            stiffness: 150,
            damping: 18,
            onUpdate: (p) => {
              el.style.opacity = String(Math.max(0, Math.min(1, p * 1.4)));
              el.style.transform = `translate3d(0,${(1 - p) * 16}px,0)`;
            },
            onDone: () => {
              el.style.opacity = '';
              el.style.transform = '';
              el.classList.add('is-revealed');
            },
          });
        }, idx * 90);
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
  );
  els.forEach((el) => {
    const t = el.getBoundingClientRect();
    if (t.top < 0.92 * innerHeight && t.bottom > 0) { el.classList.add('is-revealed'); return; } // already on screen at load
    el.classList.add('will-reveal');
    io.observe(el);
  });
}

/** Parallax layers inside [data-parallax]: children with data-depth react to pointer + scroll. */
export function initParallax() {
  const host = document.querySelector('[data-parallax]');
  if (!host || reduced()) return;
  const layers = [...host.querySelectorAll('[data-depth]')];
  let px = 0, py = 0, cx = 0, cy = 0, sy = 0, visible = true, raf = 0;
  host.addEventListener('pointermove', (e) => {
    const r = host.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width - 0.5) * 2;
    py = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  host.addEventListener('pointerleave', () => { px = 0; py = 0; });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }).observe(host);
  const loop = () => {
    cancelAnimationFrame(raf);
    if (!visible) return;
    cx += (px - cx) * 0.08;
    cy += (py - cy) * 0.08;
    sy = window.scrollY;
    layers.forEach((l) => {
      const d = Number(l.dataset.depth);
      l.style.transform = `translate3d(${cx * d * 22}px,${cy * d * 16 + sy * d * 0.16}px,0)`;
    });
    raf = requestAnimationFrame(loop);
  };
  loop();
}

/** Fixed scroll-progress bar at top of page. */
export function initProgress() {
  const bar = document.getElementById('progress');
  if (!bar) return;
  let ticking = false;
  const upd = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
  addEventListener('resize', upd);
  upd();
}

/** Spotlight: pointer position written to CSS vars on any [data-spot]. */
export function initSpotlight() {
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest && e.target.closest('[data-spot]');
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', e.clientX - r.left + 'px');
    t.style.setProperty('--my', e.clientY - r.top + 'px');
  }, { passive: true });
}

/** Count a numeric text node toward `to` over 1100ms, ease-out cubic (reference value). Flashes on change. */
export function countTo(el, to, fmt, flash = true) {
  const prev = Number(el.dataset.v);
  el.dataset.v = String(to);
  if (el._cancel) el._cancel();
  if (!Number.isFinite(to) || reduced()) { el.textContent = fmt(to); return; }
  const from = Number.isFinite(prev) ? prev : 0;
  if (from === to) { el.textContent = fmt(to); return; }
  if (flash && Number.isFinite(prev)) {
    el.classList.remove('flash-up', 'flash-down');
    void el.offsetWidth;
    el.classList.add(to > from ? 'flash-up' : 'flash-down');
  }
  const t0 = performance.now();
  let raf = 0, done = false;
  const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); clearTimeout(wd); el.textContent = fmt(to); };
  const wd = setTimeout(finish, 1300); // rAF can be starved in background tabs
  const step = (now) => {
    if (done) return;
    const r = Math.min(1, (now - t0) / 1100);
    el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - r, 3)));
    if (r < 1) raf = requestAnimationFrame(step); else finish();
  };
  raf = requestAnimationFrame(step);
  el._cancel = () => { done = true; cancelAnimationFrame(raf); clearTimeout(wd); };
}
