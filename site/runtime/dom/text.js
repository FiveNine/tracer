/*
 * Text effects for the DOM layer. Works from HTML attributes (no code needed) or from JS.
 *
 *   <h1 data-split="chars" data-reveal="rise">Made for mugs.</h1>      split + staggered reveal when it enters
 *   <p data-reveal="fade" data-delay="120">…</p>                         block reveal
 *   <h2 data-reveal="scramble">Grip-locked</h2>                          letters resolve from random glyphs
 *   <h2 data-reveal="type">typed in</h2>                                  typewriter
 *   <p data-split="words" data-scrub>…</p>                               words light up as the paragraph scrolls through
 *   <div data-marquee="40">…</div>                                        endless ticker (px/s), speeds up with scroll
 *   <b data-count="37.9" data-decimals="1">0</b>                          counts up when visible
 *
 *   initText(app, root?)  — wires every attribute above inside root (default document); returns { dispose() } for
 *   client-side page changes (call dispose before the content is replaced, then initText on the new content)
 * Presets: rise (masked, from below) · fade · blur · scale · slide (from the side) · scramble · type.
 * Stagger: data-stagger="18" (ms per unit). Screen readers read one visually hidden copy of the text; the split units
 * are aria-hidden.
 */
const GLYPHS = '!<>-_\\/[]{}—=+*^?#ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function split(el, by = 'chars') {
  if (el.dataset.splitDone) return el.querySelectorAll('.u');
  const text = el.textContent;
  const words = text.split(/(\s+)/);
  el.textContent = '';
  let i = 0;
  const frag = document.createDocumentFragment();
  // screen readers get one visually hidden copy (aria-label is ignored on generic elements such as p, span, div);
  // the visual units below are aria-hidden
  if (!el.closest('[aria-hidden="true"]')) { const sr = document.createElement('span'); sr.className = 'visually-hidden'; sr.textContent = text.replace(/\s+/g, ' ').trim(); frag.appendChild(sr); }
  for (const w of words) {
    if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(' ')); continue; }
    if (!w) continue;
    const wrap = document.createElement('span'); wrap.className = 'w'; wrap.setAttribute('aria-hidden', 'true');
    if (by === 'words') { const u = document.createElement('span'); u.className = 'u'; u.style.setProperty('--i', i++); u.textContent = w; wrap.appendChild(u); }
    else for (const ch of w) { const u = document.createElement('span'); u.className = 'u'; u.style.setProperty('--i', i++); u.textContent = ch; wrap.appendChild(u); }
    frag.appendChild(wrap);
  }
  el.appendChild(frag);
  el.dataset.splitDone = '1'; el.style.setProperty('--n', i);
  el.classList.add('is-split', 'split-' + by);
  return el.querySelectorAll('.u');
}

export function scramble(el, o = {}) {
  const units = el.querySelectorAll('.u').length ? [...el.querySelectorAll('.u')] : null;
  const finalText = units ? units.map(u => u.textContent) : [...el.textContent];
  const dur = o.duration || 900, t0 = performance.now(), n = finalText.length;
  return new Promise(res => {
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const out = finalText.map((ch, i) => {
        if (ch === ' ') return ' ';
        const reveal = (i / n) * 0.7 + 0.3 * Math.random() < p ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        return p >= 1 ? ch : reveal;
      });
      if (units) units.forEach((u, i) => { u.textContent = out[i]; }); else el.textContent = out.join('');
      if (p < 1) requestAnimationFrame(step); else res();
    })(t0);
  });
}

export function typewrite(el, o = {}) {
  const units = [...el.querySelectorAll('.u')];
  const per = o.per || 38;
  units.forEach(u => { u.style.visibility = 'hidden'; });
  return new Promise(res => units.forEach((u, i) => setTimeout(() => { u.style.visibility = ''; if (i === units.length - 1) res(); }, i * per)));
}

export function countUp(el, o = {}) {
  const to = parseFloat(o.to ?? el.dataset.count), dec = +(o.decimals ?? el.dataset.decimals ?? (String(to).split('.')[1] || '').length), dur = o.duration || 1400;
  const pre = el.dataset.prefix || '', post = el.dataset.suffix || '', t0 = performance.now();
  (function step(now) { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4); el.textContent = pre + (to * e).toFixed(dec) + post; if (p < 1) requestAnimationFrame(step); })(t0);
}

export function initText(app, root = document) {
  const reduced = app ? app.reduced : matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll('[data-split]').forEach(el => split(el, el.dataset.split || 'chars'));
  root.querySelectorAll('[data-reveal="type"],[data-reveal="scramble"]').forEach(el => { if (!el.dataset.splitDone) split(el, 'chars'); });
  const show = el => {
    if (el.classList.contains('is-in')) return;
    const delay = +(el.dataset.delay || 0);
    setTimeout(() => {
      el.classList.add('is-in');
      if (reduced) return;
      if (el.dataset.reveal === 'scramble') scramble(el, { duration: +(el.dataset.duration || 900) });
      if (el.dataset.reveal === 'type') typewrite(el, { per: +(el.dataset.per || 38) });
      if (el.hasAttribute('data-count')) countUp(el);
    }, delay);
  };
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px', threshold: 0.15 }) : null;
  const pending = new Set();
  root.querySelectorAll('[data-reveal],[data-count]').forEach(el => {
    if (el.dataset.stagger) el.style.setProperty('--stagger', el.dataset.stagger + 'ms');
    pending.add(el);
    if (reduced || !io) { el.classList.add('is-in'); if (el.hasAttribute('data-count')) el.textContent = (el.dataset.prefix || '') + el.dataset.count + (el.dataset.suffix || ''); return; }
    if (el.hasAttribute('data-reveal-now')) show(el); else io.observe(el);
  });
  // scroll-scrubbed fill: units light up with the element's progress through the viewport
  //   data-scrub (words) · data-scrub="chars" · data-scrub="blur" (chars sharpen from a blur, in reading order)
  const scrubs = [...root.querySelectorAll('[data-scrub]')].map(el => { const mode = el.dataset.scrub || 'words'; if (!el.dataset.splitDone) split(el, mode === 'words' ? 'words' : 'chars'); const units = [...el.querySelectorAll('.u')]; return { el, units, blur: mode === 'blur' && units.length <= 320, last: -1 }; });
  // letter roll on hover: each letter rolls up to reveal its twin (links, buttons)
  root.querySelectorAll('[data-roll]').forEach(el => {
    if (el.dataset.rollDone) return; el.dataset.rollDone = '1';
    const t = el.textContent; el.setAttribute('aria-label', t.trim()); el.textContent = '';
    const mk = cls => { const s = document.createElement('span'); s.className = cls; s.setAttribute('aria-hidden', 'true'); [...t].forEach((ch, i) => { const u = document.createElement('span'); u.className = 'ru'; u.style.setProperty('--i', i); u.textContent = ch === ' ' ? '\u00a0' : ch; s.appendChild(u); }); return s; };
    const box = document.createElement('span'); box.className = 'roll'; box.append(mk('roll-a'), mk('roll-b')); el.appendChild(box);
  });
  // tickers
  const marquees = [...root.querySelectorAll('[data-marquee]')].map(el => {
    const inner = document.createElement('div'); inner.className = 'marquee-track';
    while (el.firstChild) inner.appendChild(el.firstChild);
    const copy = inner.cloneNode(true); copy.setAttribute('aria-hidden', 'true');
    el.append(inner, copy); el.classList.add('marquee');
    return { el, speed: +(el.dataset.marquee || 40), x: 0, w: 0, tracks: [inner, copy] };
  });
  // safety net: anything already scrolled into or past view is revealed even if the observer missed it
  // (anchor jumps, very fast scrolls, slow frames)
  let sweep = 0;
  const remove = app && app.add((t, dt) => {
    if ((sweep += dt) > 0.25 && pending.size) {
      sweep = 0;
      // at the very bottom of the page the reader can't bring the last lines any higher: reveal whatever is visible
      const lim = innerHeight * (scrollY + innerHeight >= document.documentElement.scrollHeight - 4 ? 1 : 0.9);
      for (const el of pending) { if (el.classList.contains('is-in')) { pending.delete(el); continue; } if (el.getBoundingClientRect().top < lim) { pending.delete(el); show(el); } }
    }
    for (const s of scrubs) {
      const r = s.el.getBoundingClientRect(), vh = innerHeight;
      if (r.bottom < -vh || r.top > vh * 2) continue;
      const p = reduced ? 1 : Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      const k = p * (s.units.length + 4);
      if (Math.abs(k - s.last) < 0.01) continue; s.last = k;
      s.units.forEach((u, i) => { const v = Math.min(1, Math.max(0, k - i)); u.style.opacity = (0.16 + 0.84 * v).toFixed(3); if (s.blur) u.style.filter = v >= 1 ? '' : `blur(${((1 - v) * 6).toFixed(1)}px)`; });
    }
    for (const m of marquees) {
      if (!m.w) m.w = m.tracks[0].getBoundingClientRect().width || 1;
      if (!reduced) m.x -= (m.speed + Math.abs(app.scroll.velocity) * 0.08) * dt;
      if (m.x <= -m.w) m.x += m.w;
      m.tracks.forEach(tk => { tk.style.transform = `translate3d(${m.x.toFixed(2)}px,0,0)`; });
    }
  });
  // dispose() before replacing the content (client-side page changes): stops the updater and the observer
  return { scrubs, marquees, show, dispose() { if (remove) remove(); if (io) io.disconnect(); pending.clear(); } };
}
