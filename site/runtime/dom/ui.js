/*
 * Page chrome that every template can reuse (all optional, all driven by markup):
 *
 *   loader(app, { el: '.loader', min: 900 })  -> { done(): Promise }  real progress in --p and [data-loader-pct]
 *   cursor(app, { el: '.cursor' })            custom cursor: lerped dot/ring, labels from [data-cursor="Drag"],
 *                                             magnetic pull on [data-magnetic], hidden on touch devices
 *   soundToggle(app, el)                      button that turns app.audio on/off (aria-pressed, animated bars)
 *   autoHide(app, el)                         header hides on scroll down, returns on scroll up
 *   progressBar(app, el)                      scaleX = page progress
 *   sectionState(app, '[data-section]')       html[data-section] = id of the section in view (for chrome colours)
 */
export function loader(app, o = {}) {
  const el = typeof o.el === 'string' ? document.querySelector(o.el) : o.el || document.querySelector('.loader');
  const pct = el && el.querySelector('[data-loader-pct]');
  const t0 = performance.now();
  let shown = 0;
  const prev = app.onProgress;
  app.onProgress = p => { prev && prev(p); };
  let raf;
  (function tick() {
    shown += (Math.max(shown, app.progress) - shown) * 0.2;    // follows real progress closely; never runs backwards
    if (el) { el.style.setProperty('--p', shown.toFixed(4)); if (pct) pct.textContent = String(Math.round(shown * 100)).padStart(2, '0'); }
    raf = requestAnimationFrame(tick);
  })();
  return {
    el,
    done() {
      return new Promise(res => {
        const wait = Math.max(0, (o.min || 900) - (performance.now() - t0));
        setTimeout(() => {
          shown = 1; if (el) { el.style.setProperty('--p', 1); if (pct) pct.textContent = '100'; }
          document.documentElement.classList.add('is-loaded');
          setTimeout(() => { cancelAnimationFrame(raf); if (el) el.setAttribute('hidden', ''); res(); }, app.reduced ? 0 : (o.exit || 900));
        }, wait);
      });
    }
  };
}

export function cursor(app, o = {}) {
  if (!app.input.fine) return null;
  let el = typeof o.el === 'string' ? document.querySelector(o.el) : o.el;
  if (!el) { el = document.createElement('div'); el.className = 'cursor'; el.innerHTML = '<i></i><span></span>'; document.body.appendChild(el); }
  const label = el.querySelector('span');
  document.documentElement.classList.add('has-cursor');
  let x = innerWidth / 2, y = innerHeight / 2, s = 1;
  let mag = null;
  addEventListener('pointerover', e => {
    const t = e.target.closest('[data-cursor],a,button,[data-magnetic]');
    el.classList.toggle('is-link', !!t);
    const txt = t && t.getAttribute('data-cursor');
    el.classList.toggle('has-label', !!txt); if (label) label.textContent = txt || '';
    const m = t && t.hasAttribute('data-magnetic') ? t : null;
    if (mag && mag !== m) mag.style.transform = '';   // the one left behind goes home
    mag = m;
  });
  addEventListener('pointerdown', () => el.classList.add('is-down'));
  addEventListener('pointerup', () => el.classList.remove('is-down'));
  app.add((t, dt) => {
    let tx = app.input.x, ty = app.input.y;
    if (mag) { const r = mag.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; tx = cx + (tx - cx) * 0.35; ty = cy + (ty - cy) * 0.35;
      const cl = v => Math.max(-6, Math.min(6, v));   // a nudge, never more than a few px out of place
      mag.style.transform = `translate(${cl((app.input.x - cx) * 0.18).toFixed(1)}px, ${cl((app.input.y - cy) * 0.18).toFixed(1)}px)`; }
    const k = 1 - Math.exp(-dt * 20); x += (tx - x) * k; y += (ty - y) * k;
    s += ((1 + Math.min(0.6, app.input.speed / 4000)) - s) * k;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    el.style.setProperty('--s', s.toFixed(3));
  }, 50);
  addEventListener('pointerout', e => { if (mag && !e.relatedTarget) { mag.style.transform = ''; mag = null; } });
  document.addEventListener('pointerleave', () => el.classList.add('is-out'));
  document.addEventListener('pointerenter', () => el.classList.remove('is-out'));
  return el;
}

export function soundToggle(app, el, o = {}) {
  if (typeof el === 'string') el = document.querySelector(el);
  if (!el) return null;
  if (!app.audio.available) { el.hidden = true; return null; }
  const sync = on => { el.setAttribute('aria-pressed', on ? 'true' : 'false'); el.classList.toggle('is-on', on); const l = el.querySelector('[data-sound-label]'); if (l) l.textContent = on ? (o.on || 'sound on') : (o.off || 'sound off'); };
  sync(false);
  el.addEventListener('click', async () => { await app.audio.toggle(); });
  app.audio.onChange(sync);
  // a visitor who turned sound on before gets it back with their first gesture (browsers need one before audio can play)
  if (app.audio.remembered && app.audio.remembered()) {
    const resume = e => { removeEventListener('pointerdown', resume, true); removeEventListener('keydown', resume, true); if (e.target && e.target.closest && e.target.closest('.sound')) return; if (!app.audio.on) app.audio.enable(); };
    addEventListener('pointerdown', resume, true); addEventListener('keydown', resume, true);
  }
  return el;
}

export function autoHide(app, el, o = {}) {
  if (typeof el === 'string') el = document.querySelector(el);
  if (!el) return;
  let ref = 0;
  app.add(() => {
    const y = app.scroll.y;
    el.classList.toggle('is-stuck', y > 40);
    // o.hold(): while it returns true the header always stays (e.g. for as long as a hero is on screen)
    if (y < innerHeight * 0.6 || (o.hold && o.hold()) || document.documentElement.classList.contains('menu-open')) { el.classList.remove('is-hidden'); ref = y; }
    else if (y - ref > 14) { el.classList.add('is-hidden'); ref = y; }
    else if (ref - y > 14) { el.classList.remove('is-hidden'); ref = y; }
  });
}

export function progressBar(app, el) {
  if (typeof el === 'string') el = document.querySelector(el);
  if (!el) return;
  app.add(() => { el.style.transform = `scaleX(${app.scroll.progress.toFixed(4)})`; });
}

export function sectionState(app, sel = '[data-section]') {
  const els = [...document.querySelectorAll(sel)];
  let cur = null;
  app.add(() => {
    const mid = innerHeight * 0.5; let id = null;
    for (const el of els) { const r = el.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) { id = el.dataset.section || el.id; break; } }
    if (id !== cur) { cur = id; document.documentElement.dataset.section = id || ''; els.forEach(e => e.classList.toggle('is-current', (e.dataset.section || e.id) === id)); }
  });
}
