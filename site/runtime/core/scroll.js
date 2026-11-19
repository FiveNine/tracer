/*
 * Scroll: native scrolling (accessible, no scroll-jacking), measured.
 *
 *   app.scroll.y, .max, .progress (0..1), .velocity (px/s, smoothed), .dir (-1|0|1)
 *   app.scroll.track(el)            -> { progress, enter, visible } updated every frame for that element:
 *        progress: 0 when its top meets the viewport bottom, 1 when its bottom meets the viewport top
 *        pinned:   0..1 while a tall sticky container scrolls past (top meets top -> bottom meets bottom)
 *   app.scroll.to(target, { duration })   smooth anchor scrolling (instant with reduced motion)
 * Smoothness comes from params easing toward their targets, not from rewriting the scroll position.
 */
export function createScroll(app) {
  const tracked = new Map();
  let last = scrollY, vel = 0;
  const api = {
    y: scrollY, max: 1, progress: 0, velocity: 0, dir: 0,
    measure() {
      api.max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      for (const [el, t] of tracked) { const r = el.getBoundingClientRect(); t.top = r.top + scrollY; t.height = r.height; }
    },
    track(el) {
      if (typeof el === 'string') el = document.querySelector(el);
      if (!el) return { progress: 0, pinned: 0, visible: false };
      if (!tracked.has(el)) { const r = el.getBoundingClientRect(); tracked.set(el, { el, top: r.top + scrollY, height: r.height, progress: 0, pinned: 0, visible: false }); }
      return tracked.get(el);
    },
    update(dt) {
      const y = scrollY;
      const v = (y - last) / Math.max(dt, 1e-3);
      vel += (v - vel) * Math.min(1, dt * 10);
      api.dir = y > last ? 1 : y < last ? -1 : api.dir;
      last = y; api.y = y; api.velocity = vel; api.progress = y / api.max;
      const vh = innerHeight;
      for (const t of tracked.values()) {
        t.progress = Math.min(1, Math.max(0, (y + vh - t.top) / (t.height + vh)));
        t.pinned = Math.min(1, Math.max(0, (y - t.top) / Math.max(1, t.height - vh)));
        t.visible = y + vh > t.top && y < t.top + t.height;
      }
    },
    to(target, opts = {}) {
      let y = typeof target === 'number' ? target : (() => { const el = typeof target === 'string' ? document.querySelector(target) : target; return el ? el.getBoundingClientRect().top + scrollY : scrollY; })();
      y = Math.max(0, Math.min(api.max, y + (opts.offset || 0)));
      if (app.reduced || opts.instant) { window.scrollTo(0, y); return Promise.resolve(); }
      const from = scrollY, d = y - from, dur = opts.duration || Math.min(2.4, 0.6 + Math.abs(d) / 2400), t0 = performance.now();
      return new Promise(res => {
        (function step(now) {
          const t = Math.min(1, (now - t0) / 1000 / dur), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          window.scrollTo(0, from + d * e);
          if (t < 1) requestAnimationFrame(step); else res();
        })(t0);
      });
    }
  };
  // in-page links scroll smoothly
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2 || e.defaultPrevented) return;
    const el = document.querySelector(a.getAttribute('href'));
    if (!el) return;
    e.preventDefault(); api.to(el);
    try { history.replaceState(null, '', a.getAttribute('href')); } catch (err) { /* a sandboxed frame may refuse */ }
  });
  return api;
}
