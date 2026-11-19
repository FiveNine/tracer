/*
 * createApp: the shell every experience runs in.
 *
 *   import { createApp } from '../runtime/core/app.js';
 *   const app = createApp({ canvas: '#gl', post: { preset: 'product' }, clear: '#0b0b0c' });
 *   app.scene.add(mesh); app.camera.position.set(0, 0, 6);
 *   app.add((t, dt) => { mesh.rotation.y = app.params.get('cup.rotY'); });
 *   await app.load([ promise, promise ]);   // real progress for the loader
 *   app.start();
 *
 * It owns: renderer, default scene + camera, the post pipeline, the frame loop, resize, quality tiers and
 * dynamic resolution, reduced motion, pause when hidden, the params registry, scroll, input, audio, and the
 * QA hook (window.__studio). Without WebGL it still runs (app.gl === false): params, scroll, DOM effects and
 * audio work; the page shows its poster image (html.no-webgl).
 *
 * URL flags: ?q=low|high  ?dpr=1.5  ?nodyn (no dynamic resolution)  ?reduced  ?nogl  ?t=12 (freeze time for captures)
 */
import * as THREE from 'three';
import { createParams } from './params.js';
import { createScroll } from './scroll.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPost } from './post.js';

export function createApp(opts = {}) {
  const qs = new URLSearchParams(location.search);
  const html = document.documentElement;
  const narrow = matchMedia('(max-width: 820px)').matches;
  const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const quality = qs.get('q') || opts.quality && opts.quality !== 'auto' && opts.quality || (narrow || (navigator.hardwareConcurrency || 8) <= 4 ? 'low' : 'high');
  const fixedT = qs.has('t') ? +qs.get('t') : null;

  const app = {
    quality, narrow, reduced: reducedMQ.matches || qs.has('reduced'), gl: false,
    time: 0, dt: 0, frame: 0, ready: false, facts: {}, width: innerWidth, height: innerHeight, dpr: 1,
    params: createParams(),
    three: THREE
  };
  app.params.setReduced(app.reduced);
  if (app.reduced) html.classList.add('reduced');
  app.scroll = createScroll(app);
  app.input = createInput(app);
  app.audio = createAudio(app, { id: opts.id || location.pathname, volume: opts.volume });

  const updaters = [], afters = [], measurers = [], choreos = [], sequences = [], settleHooks = [];
  app.add = (fn, order = 0) => { updaters.push({ fn, order }); updaters.sort((a, b) => a.order - b.order); return () => { const i = updaters.findIndex(u => u.fn === fn); if (i >= 0) updaters.splice(i, 1); }; };
  app.after = fn => afters.push(fn);
  app.onMeasure = fn => measurers.push(fn);
  app.addChoreo = c => choreos.push(c);
  app.addSequence = s => { if (!sequences.includes(s)) sequences.push(s); };
  /** run fn whenever a capture settles the page (after params snap, before the frames): for state a template eases itself */
  app.onSettle = fn => { settleHooks.push(fn); };
  app.removeSequence = s => { const i = sequences.indexOf(s); if (i >= 0) sequences.splice(i, 1); };
  app.seqOwns = name => sequences.some(s => s.playing && s.names.has(name));
  app.measure = () => { app.scroll.measure(); measurers.forEach(f => f()); };

  // ---- WebGL (optional) ----
  let canvas = typeof opts.canvas === 'string' ? document.querySelector(opts.canvas) : opts.canvas;
  if (!canvas) { canvas = document.createElement('canvas'); canvas.className = 'gl'; document.body.prepend(canvas); }
  app.canvas = canvas;
  const hasGL = !qs.has('nogl') && (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  if (hasGL) {
    THREE.ColorManagement.legacyMode = false;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: opts.post === false, alpha: !!opts.transparent, powerPreference: 'high-performance', preserveDrawingBuffer: qs.has('capture') || !!opts.preserveDrawingBuffer });
    renderer.setClearColor(new THREE.Color(opts.clear || '#000000'), opts.transparent ? 0 : 1);
    if (opts.post === false) { renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; }
    else { renderer.outputEncoding = THREE.LinearEncoding; renderer.toneMapping = THREE.NoToneMapping; }
    if (opts.shadows) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = opts.shadows === 'vsm' ? THREE.VSMShadowMap : opts.shadows === 'pcf' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap; } // 'pcf' honours light.shadow.radius
    renderer.info.autoReset = false; // one frame = all passes (QA reads draw calls per frame)
    app.renderer = renderer; app.gl = true;
    app.scene = new THREE.Scene();
    app.camera = new THREE.PerspectiveCamera(opts.fov || 35, innerWidth / innerHeight, opts.near || 0.1, opts.far || 200);
    app.camera.position.set(0, 0, 8);
    app.post = opts.post === false ? null : createPost(app, opts.post || {});
    html.classList.add('has-webgl');
  } else {
    html.classList.add('no-webgl');
  }

  // ---- size, pixel ratio, dynamic resolution ----
  const cap = +(qs.get('dpr') || 0) || Math.min(devicePixelRatio || 1, quality === 'low' ? 1.25 : narrow ? 1.5 : 1.75);
  const dyn = { dpr: cap, min: Math.min(cap, 0.7), acc: 0, n: 0, lock: qs.has('dpr') || qs.has('nodyn') || fixedT != null, pending: false };
  function resize() {
    // the canvas's own box (the viewport minus a classic scrollbar), so WebGL pixels line up with the page's
    app.width = canvas.clientWidth || innerWidth; app.height = canvas.clientHeight || innerHeight; app.narrow = matchMedia('(max-width: 820px)').matches;
    if (app.gl) {
      app.dpr = dyn.dpr;
      app.renderer.setPixelRatio(dyn.dpr); app.renderer.setSize(app.width, app.height, false);
      if (app.post) app.post.setSize(canvas.width, canvas.height);
      app.camera.aspect = app.width / app.height; app.camera.updateProjectionMatrix();
    }
    resizers.forEach(f => f(app.width, app.height));
    app.measure();
  }
  const resizers = [];
  app.onResize = fn => resizers.push(fn);
  let rt = null;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 120); });
  addEventListener('load', () => app.measure());
  if (document.fonts) document.fonts.ready.then(() => app.measure());
  reducedMQ.addEventListener && reducedMQ.addEventListener('change', e => { app.reduced = e.matches; app.params.setReduced(e.matches); html.classList.toggle('reduced', e.matches); });

  // ---- render: default renders app.scene with app.camera through post; override with app.render = fn ----
  app.render = () => {
    if (!app.gl) return;
    if (app.post) app.post.render(app.scene, app.camera, app.sceneB, app.cameraB);
    else { app.renderer.setRenderTarget(null); app.renderer.render(app.scene, app.camera); }
  };

  // ---- loading with real progress ----
  const loading = { total: 0, done: 0, weights: [] };
  app.progress = 0;
  app.onProgress = opts.onProgress || (() => { });
  // named progress tracks (weights): long tasks report 0..1 as they go, the loader shows the weighted sum
  const tracks = new Map();
  function progressNow() { let w = 0, f = 0; for (const t of tracks.values()) { w += t.w; f += t.w * t.f; } return w ? f / w : 0; }
  /** const report = app.track('textures', 3); report(0.5) … report(1) */
  app.track = (name, weight = 1) => { tracks.set(name, { w: weight, f: 0 }); return f => { const t = tracks.get(name); t.f = Math.max(t.f, Math.min(1, f)); app.progress = progressNow(); app.onProgress(app.progress); }; };
  /** await app.load([promiseOrFn, …], weights?) — progress goes to opts.onProgress(0..1) */
  app.load = async (items, weights) => {
    const list = items.map((it, i) => ({ p: typeof it === 'function' ? it() : it, rep: app.track('load:' + i + ':' + Math.random().toString(36).slice(2, 6), weights ? weights[i] : 1) }));
    await Promise.all(list.map(x => Promise.resolve(x.p).then(r => { x.rep(1); return r; })));
    app.progress = progressNow(); app.onProgress(app.progress);   // other tracks (e.g. 'shaders') may still be running
  };
  /** yield-friendly heavy work: await app.idle() between chunks so the loader keeps animating */
  app.idle = () => new Promise(r => setTimeout(r, 0));

  // ---- the loop ----
  let last = performance.now(), running = false, raf = 0;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (document.hidden) { last = now; return; }
    let dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (fixedT != null) { dt = 1 / 60; app.time = fixedT; } else app.time += dt;
    step(dt);
    // dynamic resolution: average frame time decides; the resize happens right before drawing
    if (!dyn.lock && app.gl) {
      dyn.acc += dt; dyn.n++;
      if (dyn.n >= 40) { const avg = dyn.acc / dyn.n; dyn.acc = 0; dyn.n = 0;
        if (avg > 0.026 && dyn.dpr > dyn.min) { dyn.dpr = Math.max(dyn.min, dyn.dpr - 0.15); dyn.pending = true; }
        else if (avg < 0.014 && dyn.dpr < cap) { dyn.dpr = Math.min(cap, dyn.dpr + 0.1); dyn.pending = true; } }
      if (dyn.pending) { dyn.pending = false; resize(); }
    }
    if (app.gl) app.renderer.info.reset();
    app.render();
    afters.forEach(f => f(app.time, dt));
  }
  function step(dt) {
    app.dt = dt; app.frame++;
    app.input.update(dt);
    app.scroll.update(dt);
    choreos.forEach(c => c.update());
    sequences.slice().forEach(s => s.update());
    app.params.update(dt);
    app.audio.update();
    for (const u of updaters) u.fn(app.time, dt, app);
  }
  app.start = () => {
    if (running) return; running = true;
    resize();
    app.ready = true; html.classList.add('is-ready');
    last = performance.now(); raf = requestAnimationFrame(tick);
  };
  app.stop = () => { running = false; cancelAnimationFrame(raf); };

  // ---- QA / tools hook: deterministic seeking without real scrolling ----
  window.__studio = {
    app,
    get ready() { return app.ready; },
    params: () => app.params.list(),
    facts: () => app.facts,
    choreo: () => choreos.map(c => c.positions()),
    /** jump to a scroll position and settle every eased value there, then draw one frame */
    settle(y, frames = 3) {
      // intros and other time sequences jump to their end first, so captures show the resting composition
      sequences.slice().forEach(sq => { sq.sample(sq.duration); sq.stop(); });
      if (y != null) window.scrollTo(0, y);
      app.scroll.update(1 / 60); choreos.forEach(c => c.update()); app.params.snap();
      settleHooks.forEach(f => f());   // state a template eases on its own (not a param) lands too
      for (let i = 0; i < frames; i++) step(1 / 60);
      if (app.gl) app.renderer.info.reset();
      app.render();
    },
    info: () => app.gl ? { calls: app.renderer.info.render.calls, triangles: app.renderer.info.render.triangles, geometries: app.renderer.info.memory.geometries, textures: app.renderer.info.memory.textures, dpr: dyn.dpr, quality } : { gl: false }
  };
  return app;
}
