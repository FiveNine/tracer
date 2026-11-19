/*
 * Params: the one place where animatable values live.
 *
 * Every value a scene, the camera or the post pipeline wants to animate is registered here by name
 * ("camera.fov", "cup.lift", "post.bloom"). Keyframes (choreo.js), sequences, interactions and editors
 * only ever write *targets*; the registry eases the current values toward them every frame, so motion is
 * always smooth and anything can drive anything. Values are numbers or fixed-length number arrays
 * (vectors, colours as [r, g, b] 0..1).
 *
 *   const P = createParams();
 *   P.define('cup.lift', 0, { min: 0, max: 1, rate: 3 });
 *   P.set('cup.lift', 1);            // target
 *   P.get('cup.lift');               // eased current value
 *   P.update(dt);                    // once per frame (the app does it)
 */
export function createParams() {
  const defs = new Map();
  let reduced = false;

  function clone(v) { return Array.isArray(v) ? v.slice() : v; }
  function parse(v) {
    if (typeof v === 'string' && v[0] === '#') { // '#rrggbb' -> [r, g, b] in 0..1 (sRGB)
      const n = parseInt(v.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    return clone(v);
  }

  const api = {
    /** Register a value. opts: { min, max, step, rate (ease speed, 1/s; 0 = instant), label, group } */
    define(name, value, opts = {}) {
      const v = parse(value);
      if (defs.has(name)) return api; // first definition wins (templates may define defaults twice)
      defs.set(name, { name, def: clone(v), cur: clone(v), target: clone(v), rate: opts.rate ?? 3.2, opts });
      return api;
    },
    /** Register many: { name: value | [value, opts] } */
    defineAll(obj) {
      for (const k in obj) { const e = obj[k]; if (Array.isArray(e) && e.length === 2 && typeof e[1] === 'object' && !Array.isArray(e[1])) api.define(k, e[0], e[1]); else api.define(k, e); }
      return api;
    },
    has: name => defs.has(name),
    get(name) { const d = defs.get(name); return d ? d.cur : undefined; },
    target(name) { const d = defs.get(name); return d ? d.target : undefined; },
    default(name) { const d = defs.get(name); return d ? d.def : undefined; },
    /** Set a target (eased). snap = jump there now. Unknown names are ignored with a console warning once. */
    set(name, value, snap = false) {
      const d = defs.get(name);
      if (!d) { warn(name); return; }
      const v = parse(value);
      if (Array.isArray(d.target)) { for (let i = 0; i < d.target.length; i++) d.target[i] = v[i] ?? d.target[i]; }
      else d.target = v;
      if (snap) d.cur = clone(d.target);
    },
    setAll(obj, snap = false) { for (const k in obj) api.set(k, obj[k], snap); },
    setRate(name, rate) { const d = defs.get(name); if (d) d.rate = rate; },
    /** hold(name): choreography stops driving this param (e.g. the visitor picked a colour); hold(name, false) releases */
    hold(name, on = true) { const d = defs.get(name); if (d) d.held = !!on; },
    held(name) { const d = defs.get(name); return !!(d && d.held); },
    reset(names) { for (const d of defs.values()) if (!names || names.includes(d.name)) d.target = clone(d.def); },
    snap() { for (const d of defs.values()) d.cur = clone(d.target); },
    setReduced(v) { reduced = !!v; },
    update(dt) {
      for (const d of defs.values()) {
        const k = reduced || d.rate <= 0 ? 1 : 1 - Math.exp(-dt * d.rate);
        if (Array.isArray(d.cur)) { for (let i = 0; i < d.cur.length; i++) d.cur[i] += (d.target[i] - d.cur[i]) * k; }
        else d.cur += (d.target - d.cur) * k;
      }
    },
    /** For editors / node UIs / QA: every param with its range and current value */
    list() { return [...defs.values()].map(d => ({ name: d.name, value: clone(d.cur), target: clone(d.target), default: clone(d.def), ...d.opts })); },
    names: () => [...defs.keys()]
  };
  const warned = new Set();
  function warn(n) { if (!warned.has(n)) { warned.add(n); console.warn('[params] unknown param "' + n + '"'); } }
  return api;
}

/* Easing library (shared by choreo, sequences and DOM effects) */
export const ease = {
  linear: t => t,
  inQuad: t => t * t, outQuad: t => t * (2 - t), inOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  inCubic: t => t * t * t, outCubic: t => (--t) * t * t + 1,
  inOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  inQuart: t => t * t * t * t, outQuart: t => 1 - (--t) * t * t * t,
  inOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
  outExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inOutExpo: t => t === 0 || t === 1 ? t : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  /* Kage's travel curve: slow start, long glide, soft landing */
  glide: t => { const a = 0.12, b = 0.94; t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); },
  smooth: t => t * t * (3 - 2 * t)
};
export function easeFn(e) { return typeof e === 'function' ? e : ease[e] || ease.inOutCubic; }
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
