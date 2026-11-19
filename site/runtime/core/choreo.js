/*
 * Choreography: keyframes of params, placed on the page (scroll) or on a clock (time).
 *
 * Scroll choreography — the page is the timeline:
 *   createChoreo(app, [
 *     { at: '#hero',                 set: { 'cup.rotY': 0, 'camera.fov': 30 } },
 *     { at: '#lift', offset: 0.5,    set: { 'cup.lift': 1 }, ease: 'outCubic' },
 *     { at: '#lift', offset: 1, hold: 0.3, set: { 'cup.lift': 0 } },
 *     { at: 1,                       set: { 'post.fade': 0.4 } }       // number = fraction of the whole page
 *   ]);
 *  - `at`: a CSS selector (the scroll position where that element's top meets the viewport top) or a number 0..1.
 *  - `offset`: fraction of that element's height added to its position (0.5 = half-way through it).
 *  - `shift`: extra pixels, or a string like "-50vh".
 *  - Between two keys every param named in either is interpolated; a param keeps its last value until a key
 *    changes it (forward fill); `reset: true` sends unnamed params back to their defaults.
 *  - `hold` (0..1): the previous key's pose holds for that share of the way before moving on.
 *  - `ease`: curve used on the way INTO this key (default 'inOutCubic'; 'glide' is Kage's travel curve).
 * The choreography only sets param *targets*; params ease them, so scrolling fast still looks smooth.
 *
 * Time sequences — intros, reactions to a click or a gesture:
 *   const intro = createSequence(app, [ { at: 0, set: {...} }, { at: 1.6, set: {...}, ease: 'outExpo' } ]);
 *   await intro.play();   // while playing it overrides the scroll choreography for the params it names
 */
import { easeFn, clamp, lerp } from './params.js';

function resolveKeys(app, keys) {
  const doc = document.documentElement, vh = innerHeight;
  const max = Math.max(1, doc.scrollHeight - vh);
  const out = [];
  for (const k of keys) {
    let y;
    if (typeof k.at === 'number') y = k.at * max;
    else {
      const el = document.querySelector(k.at);
      if (!el) { console.warn('[choreo] no element for', k.at); continue; }
      const r = el.getBoundingClientRect();
      y = r.top + scrollY + (k.offset || 0) * r.height;
    }
    if (k.shift) y += typeof k.shift === 'string' && k.shift.endsWith('vh') ? parseFloat(k.shift) / 100 * vh : +k.shift;
    out.push({ ...k, y: clamp(y, 0, max) });
  }
  out.sort((a, b) => a.y - b.y);
  return out;
}

const warned = new Set();
/* forward-fill: every key gets a complete snapshot of all params named anywhere in the choreography */
function fill(app, keys) {
  const names = new Set();
  keys.forEach(k => Object.keys(k.set || {}).forEach(n => names.add(n)));
  const P = app.params;
  let last = {};
  names.forEach(n => { if (P.has(n)) last[n] = P.default(n); else if (!warned.has(n)) { warned.add(n); console.warn('[choreo] unknown param', n); } });
  for (const k of keys) {
    const snap = {};
    if (k.reset) names.forEach(n => { if (P.has(n)) snap[n] = P.default(n); });
    else Object.assign(snap, last);
    for (const n in k.set || {}) if (P.has(n)) snap[n] = parseVal(k.set[n]);
    k.full = snap; last = snap;
  }
  return [...names].filter(n => P.has(n));
}
function parseVal(v) {
  if (typeof v === 'string' && v[0] === '#') { const n = parseInt(v.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
  return v;
}
function mix(a, b, t) {
  if (Array.isArray(a)) return a.map((v, i) => lerp(v, b[i] ?? v, t));
  return lerp(a, b, t);
}

export function createChoreo(app, keys, opts = {}) {
  let resolved = [], names = [];
  const api = {
    keys, enabled: true,
    measure() { resolved = resolveKeys(app, keys); names = fill(app, resolved); return resolved; },
    /** param snapshot for a scroll position (used every frame and by editors/QA) */
    at(y) {
      const K = resolved;
      if (!K.length) return null;
      if (y <= K[0].y) return K[0].full;
      if (y >= K[K.length - 1].y) return K[K.length - 1].full;
      let i = 0; while (i < K.length - 2 && y >= K[i + 1].y) i++;
      const A = K[i], B = K[i + 1];
      let t = (y - A.y) / Math.max(1, B.y - A.y);
      const hold = B.hold || 0;
      t = hold ? clamp((t - hold) / (1 - hold), 0, 1) : t;
      t = easeFn(B.ease || opts.ease || 'inOutCubic')(t);
      const o = {};
      for (const n of names) o[n] = mix(A.full[n], B.full[n], t);
      return o;
    },
    /** which key the page is at or past (for chapter UI, audio cues, analytics) */
    index(y) { let i = 0; for (let k = 0; k < resolved.length; k++) if (y >= resolved[k].y - 2) i = k; return i; },
    positions: () => resolved.map(k => k.y),
    update() {
      if (!api.enabled || !resolved.length) return;
      const snap = api.at(app.scroll.y);
      for (const n in snap) if (!app.seqOwns(n) && !app.params.held(n)) app.params.set(n, snap[n]);
    }
  };
  app.onMeasure(api.measure);
  app.addChoreo(api);
  api.measure();
  return api;
}

export function createSequence(app, keys, opts = {}) {
  const K = keys.slice().sort((a, b) => a.at - b.at);
  const names = new Set(); K.forEach(k => Object.keys(k.set || {}).forEach(n => names.add(n)));
  let t0 = 0, playing = false, resolve = null, snapStart = null;
  const dur = K.length ? K[K.length - 1].at : 0;
  const api = {
    names, duration: dur, get playing() { return playing; },
    play() {
      snapStart = {}; names.forEach(n => { if (app.params.has(n)) snapStart[n] = JSON.parse(JSON.stringify(app.params.get(n))); });
      t0 = app.time; playing = true; app.addSequence(api);
      if (app.reduced || opts.instant) { api.sample(dur); api.stop(); return Promise.resolve(); }
      return new Promise(r => { resolve = r; });
    },
    stop() { playing = false; app.removeSequence(api); if (resolve) { resolve(); resolve = null; } },
    sample(t) {
      for (const n of names) {
        if (!app.params.has(n)) continue;
        // keys that name this param, with the starting value as an implicit key at 0
        const ks = K.filter(k => k.set && n in k.set).map(k => ({ at: k.at, v: parseVal(k.set[n]), ease: k.ease }));
        if (!ks.length || ks[0].at > 0) ks.unshift({ at: 0, v: snapStart[n] });   // start from where the value is now
        let v = ks[ks.length - 1].v;
        for (let i = 0; i < ks.length - 1; i++) {
          if (t <= ks[i + 1].at) { const a = ks[i], b = ks[i + 1]; const u = clamp((t - a.at) / Math.max(1e-6, b.at - a.at), 0, 1); v = mix(a.v, b.v, easeFn(b.ease || opts.ease || 'inOutCubic')(u)); break; }
        }
        app.params.set(n, v, opts.snap !== false);
      }
    },
    update() {
      if (!playing) return;
      const t = app.time - t0;
      api.sample(Math.min(t, dur));
      if (t >= dur) api.stop();
    }
  };
  return api;
}
