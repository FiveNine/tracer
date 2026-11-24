/*
 * trace: one line of light that draws the brand's name, then re-routes itself into each chapter's diagram.
 * Order (templates/README.md): loader → DOM effects → the line built in tracked steps → site modules → scroll keys →
 * shaders compiled behind the loader → start → the intro (the line traces the mark).
 */
import * as THREE from 'three';
import { createApp } from '../runtime/core/app.js';
import { createChoreo, createSequence } from '../runtime/core/choreo.js';
import { initText } from '../runtime/dom/text.js';
import { loader, cursor, autoHide } from '../runtime/dom/ui.js';
import { makeShape } from './scene/shapes.js';
import { createLine } from './scene/line.js';
import { createField } from './scene/field.js';
import { createFill } from './scene/fill.js';
import { createDiscs } from './scene/discs.js';
import { createTokenize } from './scene/tokenize.js';

const S = window.SITE, X = S.experience || {}, C = S.content;
const PID = document.body.dataset.page || 'index';
const XP = (X.pages || {})[PID] || { shapes: ['mark'], keys: [] };
const colors = S.theme.colors;
const app = createApp({ canvas: '.gl', post: X.look || { preset: 'editorial', tonemap: 'linear' }, clear: colors.blue || colors.accent, fov: 30, id: S.slug });
const P = app.params;
const ld = loader(app, { min: PID === 'index' ? 700 : 250, exit: 600 });
initText(app); cursor(app);
// the header stays for the whole hero (the logo docks into it there) and only hides on the way down past it
const heroEl = document.querySelector('.page-index #hero');
autoHide(app, '[data-top]', { hold: () => !!heroEl && heroEl.getBoundingClientRect().bottom > 0 });
app.facts = {
  genre: 'trace', look: (X.look || {}).preset || 'editorial',
  signature: 'one line of light traces the Tracer wordmark, then sweeps across a photo of real carbon removal and turns what it passes into a dot screen (one dot, one gram), threads round windows onto removal projects, and draws Tracy; touch the line and a signal runs along it',
  interactions: ['touch the line: a signal runs both ways from the touch', 'the line moves aside for the pointer', '"Send a trace" button (keyboard alternative)', 'copy the contract address', 'add TRCR to a wallet', 'FAQ search', 'Tracy: answers from the FAQ'],
  sound: 'none (the client asked for a calm, clear site)'
};

/* ---------- tone: the world is blue (white line) or paper (blue line); the page's ink follows ---------- */
const root = document.documentElement;
let kShown = -1;
// the scroll keys move 'tone' gradually; what is shown snaps to the nearer world and eases there quickly, so the page is
// never left in a half-blue, half-paper wash when the reader stops scrolling between two sections
P.define('tone.view', 0, { rate: 3.2 });
app.add(() => { if (P.has('tone')) P.set('tone.view', P.get('tone') > 0.5 ? 1 : 0); }, 1);
app.add(() => {
  const tv = P.get('tone.view'), k = Math.round(tv * tv * tv * (tv * (tv * 6 - 15) + 10) * 1000) / 1000;
  if (k !== kShown) { root.style.setProperty('--k', k); root.classList.toggle('on-blue', k < 0.5); kShown = k; }
}, 20);

/* ---------- the line ---------- */
let line = null, field = null;
let lean = 1, docking = false;   // the camera's lean (damped while the logo docks) · the dock owns the line
let textRects = [];   // the copy on screen this frame (CSS px): the line, its labels and artwork step back behind it
const keysOf = list => (list || []).map(k => {
  const set = Object.assign({}, k.set, app.narrow && k.narrow ? k.narrow : {});
  return Object.assign({}, k, { set });
});
async function build() {
  const marks = await fetch('assets/marks.json').then(r => r.json());
  await app.idle();
  const N = app.quality === 'low' ? 2048 : 3072;
  const shapes = XP.shapes.map(s => makeShape(s, marks, N));
  await app.idle();
  P.define('tone', 0, { rate: 4 });
  if (!app.gl) return;
  field = createField(app, { blue: colors.blue, alpha: X.fieldAlpha ?? 0.24 });
  line = createLine(app, { N, shapes, colors: { blue: colors.blue, paper: colors.paper, hotOnBlue: colors.hotOnBlue, hotOnPaper: colors.hotOnPaper } });
  // shapes with solid areas ({ kind, fill: '<marks key>' }): the line fills them in its own colour once drawn
  XP.shapes.forEach((sp, k) => { if (sp && sp.fill && marks[sp.fill]) createFill(app, line, { k, regions: marks[sp.fill], h: sp.h, blue: colors.blue }); });
  // photos: round windows the line threads through ({ kind: 'thread', photos }), and the photo the line tokenizes
  // as it sweeps across it ({ kind: 'sweep', photo, from, to })
  const jobs = [];
  XP.shapes.forEach((sp, k) => {
    if (sp && sp.photos && shapes[k].discs) jobs.push(createDiscs(app, line, { k, discs: shapes[k].discs, photos: sp.photos.map(p => 'assets/' + p) }));
    if (sp && sp.photo) jobs.push(createTokenize(app, { src: 'assets/' + sp.photo, el: document.querySelector('[data-tok]'), from: sp.from, to: sp.to, nFrom: sp.nFrom, nTo: sp.nTo, blue: colors.blue, paper: colors.paper }));
  });
  await Promise.all(jobs);
  app.camera.position.set(0, 0, 11.3);
  // a breath of depth: the camera leans with the pointer
  let cx = 0, cy = 0;
  app.add((t, dt) => {
    const k = 1 - Math.exp(-dt * 2.5);
    cx += ((app.reduced ? 0 : app.input.nx * 0.22 * lean) - cx) * k; cy += ((app.reduced ? 0 : app.input.ny * 0.14 * lean) - cy) * k;
    app.camera.position.set(cx, cy, 11.3); app.camera.lookAt(0, 0, 0);
  }, 5);
}

/* ---------- labels pinned to the line's stations ---------- */
function labels() {
  const box = document.querySelector('[data-tags]');
  if (!box || !line) return;
  const arts = [...box.querySelectorAll('[data-art]')].map(el => ({ el, k: +el.dataset.k, op: -1, fill: el.hasAttribute('data-fill'), since: -1, filled: false }));
  const items = [...box.querySelectorAll('[data-tag]')].map(el => ({ el, id: el.dataset.tag, k: +el.dataset.k, op: -1, x: 0, y: 0 }));
  const v = new THREE.Vector3();
  app.add(() => {
    const s = P.get('line.shape'), draw = P.get('line.draw'), alpha = P.get('line.alpha');
    for (const it of items) {
      const near = Math.max(0, 1 - Math.abs(s - it.k) * 3.2) * (draw > 0.96 ? 1 : 0) * Math.min(1, alpha * 1.5) * line.fade;
      let op = Math.round(near * 100) / 100;
      if (op > 0.01 && line.node(it.k, it.id, v)) {
        v.project(app.camera);
        const x = (v.x + 1) / 2 * app.width, y = (1 - v.y) / 2 * app.height;
        if (Math.abs(x - it.x) > 0.3 || Math.abs(y - it.y) > 0.3) { it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; it.x = x; it.y = y; }
        if (textRects.some(r => x > r.left - 30 && x < r.right + 30 && y > r.top - 20 && y < r.bottom + 20)) op = 0;   // never under the words
      }
      if (op !== it.op) { it.el.style.opacity = String(op); it.el.classList.toggle('is-on', op > 0.5); it.op = op; }
    }
    // artwork laid over a shape (Tracy's line art over her silhouette): fitted to two corner nodes, in only once the line has arrived
    for (const it of arts) {
      const near = Math.max(0, 1 - Math.abs(s - it.k) * 7) * (draw > 0.98 ? 1 : 0) * Math.min(1, alpha * 1.5) * line.fade;
      let op = Math.round(near * near * 100) / 100;
      if (it.fill) {
        // the colours fill in once the line has finished drawing (it has settled on the shape for a moment);
        // they wipe up from the bottom (CSS), and clear as soon as the line starts to leave
        op = near > 0.5 ? 1 : 0;
        if (near > 0.985) { if (it.since < 0) it.since = app.time; } else it.since = -1;
        const want = it.since >= 0 && app.time - it.since > (app.reduced ? 0 : 0.35);
        if (near < 0.9 && it.filled) { it.el.classList.remove('is-filled'); it.filled = false; }
        else if (want && !it.filled) { it.el.classList.add('is-filled'); it.filled = true; }
      }
      if (op > 0.01 && line.node(it.k, 'tl', v)) {
        v.project(app.camera); const x0 = (v.x + 1) / 2 * app.width, y0 = (1 - v.y) / 2 * app.height;
        line.node(it.k, 'br', v); v.project(app.camera); const x1 = (v.x + 1) / 2 * app.width, y1 = (1 - v.y) / 2 * app.height;
        it.el.style.transform = `translate3d(${x0.toFixed(1)}px, ${y0.toFixed(1)}px, 0)`;
        it.el.style.width = (x1 - x0).toFixed(1) + 'px'; it.el.style.height = (y1 - y0).toFixed(1) + 'px';
      }
      if (op !== it.op) { it.el.style.opacity = String(op); it.op = op; }
    }
  }, 900);
}

/* ---------- the line never competes with the words ---------- */
// When copy scrolls across the line (mostly on phones, where the line waits at the top while the text moves up),
// the whole line steps back together, smoothly; its labels and artwork with it. No patches, no boxes.
function occlusion() {
  if (!line) return;
  const blocks = [...document.querySelectorAll('.sec-in > :not([data-stage]):not([data-tok]), .tok-copy > *, .foot-top > *, .foot-cols')];   // the hero's reserved box is the line's, not copy; in the pinned photo chapter only its copy counts
  const box = {};
  let fade = 1;
  app.add((t, dt) => {
    const vh = app.height;
    line.screenBox(box);
    const A = Math.max(1, (box.right - box.left) * (box.bottom - box.top));
    let cover = 0;
    const rects = [];
    for (const el of blocks) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh || r.width < 2 || r.height < 2) continue;
      rects.push(r);
      const ix = Math.max(0, Math.min(box.right, r.right + 16) - Math.max(box.left, r.left - 16));
      const iy = Math.max(0, Math.min(box.bottom, r.bottom + 16) - Math.max(box.top, r.top - 16));
      cover += ix * iy / A;
    }
    textRects = rects;
    const target = docking ? 1 : 1 - 0.82 * Math.min(1, Math.max(0, (cover - 0.03) / 0.22));
    fade += (target - fade) * Math.min(1, dt * 6);
    line.fade = fade;
  }, 8);
}

/* ---------- the hero's mark sits in a box the layout keeps free for it ---------- */
// The page reserves [data-stage] for the wordmark; the first key is fitted to that box, so the mark and the
// headline never overlap, whatever the window's shape.
function fitStage(keys) {
  const el = document.querySelector('[data-stage]');
  if (!el || !line || !keys[0]) return;
  const fit = () => {
    const r = el.getBoundingClientRect(), y0 = r.top + scrollY;   // the hero key sits at the top of the page
    const W = innerWidth, H = innerHeight;
    const vhw = 2 * Math.tan(THREE.MathUtils.degToRad(app.camera.fov / 2)) * 11.3, wpp = vhw / H;   // world units per CSS px
    const b = line.bounds(0), bw = b[2] - b[0], bh = b[3] - b[1];
    const sc = Math.min(r.width * wpp / bw, r.height * wpp / bh);
    const cx = r.left + r.width / 2, cy = y0 + r.height / 2;
    Object.assign(keys[0].set, {
      'line.x': +((cx - W / 2) / (W / 2) - (b[0] + b[2]) / 2 * sc / (vhw * W / H / 2)).toFixed(4),
      'line.y': +((H / 2 - cy) / (H / 2) - (b[1] + b[3]) / 2 * sc / (vhw / 2)).toFixed(4),
      'line.s': +sc.toFixed(4)
    });
    for (const k of keys) if (k.asFirst) for (const n of ['line.x', 'line.y', 'line.s']) k.set[n] = keys[0].set[n];
  };
  fit();
  app.onMeasure(fit);   // before the choreography re-reads its keys (it measures after this)
}

/* ---------- the line rides the page where it belongs to a section ---------- */
// The closing mark stays with the last section when the footer comes up beneath it, instead of hanging fixed on screen.
function carry() {
  if (!line) return;
  const foot = document.querySelector('#footer');
  app.add(() => {
    const vh = app.height; let dy = 0;
    if (foot) { const r = foot.getBoundingClientRect(); dy += Math.max(0, vh - r.top) / vh * 2; }
    line.dy = dy;
  }, 9);
}

/* ---------- the logo: one, docking into the header ---------- */
// At the top of the homepage the traced wordmark stands alone in the middle and the header's links are centred (the
// header's own logo is hidden). When the wordmark is about to slip under the header, a short timed move plays (not tied
// to scroll): the line travels. One route is laid out on screen: the big wordmark as it stands, a curve up to the
// header, and the wordmark again at the header logo's size and place. The visible part of the line slides along that
// route: its front runs out of the big wordmark, along the curve, and writes the small one, while its back leaves the
// big wordmark from where it was first traced. Nothing is reshaped; the line only moves along its path. Then the
// header logo fills in under it. Scrolling back up runs the same route backwards. The route is rebuilt every frame of
// the move from where the hero wordmark and the header logo actually are, so it always starts and ends in place.
function dock(keys) {
  const brand = document.querySelector('.top .brand'), mark = brand && brand.querySelector('svg');
  const nav = document.querySelector('.top .nav'), hero = document.querySelector('.page-index #hero'), top = document.querySelector('[data-top]');
  const stage = document.querySelector('.page-index [data-stage]');
  if (!line || !mark || !hero || !stage || !keys[0] || !line.shapes[1]) return;
  root.classList.add('has-dock');
  const io = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2, clamp = v => Math.min(1, Math.max(0, v));
  const seg = (v, a, b) => clamp((v - a) / (b - a));
  let navDx = 0;
  const measure = () => { if (!nav) return; const was = nav.style.transform; nav.style.transition = 'none'; nav.style.transform = ''; const r = nav.getBoundingClientRect(); navDx = r.width ? innerWidth / 2 - (r.left + r.width / 2) : 0; nav.style.transform = was; void nav.offsetWidth; nav.style.transition = ''; };
  measure(); app.onMeasure(measure); addEventListener('resize', measure);

  // the wordmark's strokes exactly as the line draws them (shape 0), as closed runs in its own units
  const N = line.N, W0 = line.shapes[0].data, runs = [];
  for (let i = 0; i < N;) {
    if (W0[i * 4 + 3] <= 0) { i++; continue; }
    let j = i; while (j + 1 < N && W0[(j + 1) * 4 + 3] > 0) j++;
    const r = []; for (let q = i; q <= j; q++) r.push([W0[q * 4], W0[q * 4 + 1]]);
    if (r.length > 2) runs.push(r);
    i = j + 1;
  }
  const area = r => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return (x1 - x0) * (y1 - y0); };
  const oi = runs.reduce((m, r, i) => area(r) > area(runs[m]) ? i : m, 0);
  // the outline starts and ends at its top-left corner: the line leaves the big wordmark there and enters the small one there
  const fromTopLeft = r => {
    const closed = Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < 0.05, body = closed ? r.slice(0, -1) : r;
    let k = 0; body.forEach((p, i) => { if (p[0] - p[1] < body[k][0] - body[k][1]) k = i; });
    const o = body.slice(k).concat(body.slice(0, k)); o.push(o[0]); return o;
  };
  const outer = fromTopLeft(runs[oi]), counters = runs.filter((_, i) => i !== oi);
  const b0 = line.bounds(0), bw = b0[2] - b0[0];
  const view = () => { const H = innerHeight, W = innerWidth, vh = 2 * Math.tan(THREE.MathUtils.degToRad(app.camera.fov / 2)) * 11.3; return { W, H, vh, vw: vh * W / H }; };
  const place = (r, ps, V) => r.map(p => [p[0] * ps.s + ps.x * V.vw / 2, p[1] * ps.s + ps.y * V.vh / 2]);
  const landing = V => {   // the word fitted exactly over the header logo
    const r = mark.getBoundingClientRect(), sc = r.width * (V.vh / V.H) / bw;
    return { s: sc, x: (r.left + r.width / 2 - V.W / 2) / (V.W / 2) - (b0[0] + b0[2]) / 2 * sc / (V.vw / 2), y: (V.H / 2 - (r.top + r.height / 2)) / (V.H / 2) - (b0[1] + b0[3]) / 2 * sc / (V.vh / 2) };
  };
  // the route: big counters, big outline (ending top-left), the curve, small outline (from top-left), small counters
  const route = new Float32Array(N * 4);
  const build = (big, small, V) => {
    const bc = counters.map(r => place(r, big, V)), bo = place(outer, big, V), so = place(outer, small, V), sc = counters.map(r => place(r, small, V));
    const P = bo[bo.length - 1], Q = so[0], d = Math.hypot(Q[0] - P[0], Q[1] - P[1]) || 1;
    const dirP = [P[0] - bo[bo.length - 4][0], P[1] - bo[bo.length - 4][1]], lp = Math.hypot(...dirP) || 1;
    const dirQ = [so[3][0] - Q[0], so[3][1] - Q[1]], lq = Math.hypot(...dirQ) || 1;
    // leave along the outline's own direction, turned upwards; arrive along the small outline's first stroke
    const c1 = [P[0] + (dirP[0] / lp * 0.5) * d * 0.35, P[1] + (dirP[1] / lp * 0.5 + 0.7) * d * 0.35];
    const c2 = [Q[0] - dirQ[0] / lq * d * 0.3, Q[1] - dirQ[1] / lq * d * 0.3];
    // the curve never rises above the header logo's line, so the line never leaves the screen on its way
    c1[1] = Math.min(c1[1], Q[1]); c2[1] = Math.min(c2[1], Q[1]);
    const curve = []; for (let k = 1; k < 64; k++) { const t = k / 64, u = 1 - t; curve.push([u * u * u * P[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * Q[0], u * u * u * P[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * Q[1]]); }
    const through = bo.concat(curve, so), iA = bo.length - 1, iB = bo.length - 1 + curve.length + 1;
    const polys = [...bc, through, ...sc], throughAt = bc.length;
    // segments: strokes are visible, the jumps between strokes hidden (sampled sparsely, as the shapes are)
    const segs = []; let prev = null, segA = 0, segB = 0;
    polys.forEach((pl, pi) => {
      if (prev) segs.push({ a: prev, b: pl[0], vis: 0 });
      if (pi === throughAt) { segA = segs.length + iA; segB = segs.length + iB; }
      for (let q = 0; q < pl.length - 1; q++) segs.push({ a: pl[q], b: pl[q + 1], vis: 1 });
      prev = pl[pl.length - 1];
    });
    const len = segs.map(g => Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1])), visible = len.reduce((s, l, i) => s + (segs[i].vis ? l : 0), 0);
    const minJump = 4 * visible / N, w = len.map((l, i) => segs[i].vis ? l : Math.max(l * 0.08, minJump));
    const total = w.reduce((s, v) => s + v, 0) || 1;
    let wA = 0, wB = 0; for (let i = 0; i < segs.length; i++) { if (i < segA) wA += w[i]; if (i < segB) wB += w[i]; }
    let si = 0, acc = 0;
    for (let i = 0; i < N; i++) {
      const target = i / (N - 1) * total;
      while (si < segs.length - 1 && acc + w[si] < target) { acc += w[si]; si++; }
      const g = segs[si], t = w[si] > 0 ? clamp((target - acc) / w[si]) : 0;
      route[i * 4] = g.a[0] + (g.b[0] - g.a[0]) * t; route[i * 4 + 1] = g.a[1] + (g.b[1] - g.a[1]) * t; route[i * 4 + 2] = 0; route[i * 4 + 3] = g.vis;
    }
    for (let i = 1; i < N - 1; i++) {   // the samples either side of a hidden jump sit on the stroke ends (no faint diagonals)
      const v = route[i * 4 + 3];
      const snap = j => { route[i * 4] = route[j * 4]; route[i * 4 + 1] = route[j * 4 + 1]; };
      if (v === 0 && route[(i - 1) * 4 + 3] > 0) snap(i - 1); else if (v === 0 && route[(i + 1) * 4 + 3] > 0) snap(i + 1);
    }
    line.shapes[1].data.set(route);
    line.texture.image.data.set(route, N * 4); line.texture.needsUpdate = true;
    return { ua: wA / total, ub: wB / total };
  };

  const DUR = 1.4;   // the travel 0–.84 · the header logo fills in under the line .84–1
  let k = 0, docked = false, moved = false;
  const setNav = on => { if (!nav) return; nav.style.transform = on || innerWidth <= 820 ? '' : `translateX(${navDx.toFixed(1)}px)`; };
  setNav(false);
  window.__dock = { get k() { return k; }, get docked() { return docked; } };   // for stills and QA
  app.add((t, dt) => {
    const vh = innerHeight, y = scrollY;
    if (y > hero.offsetHeight + vh) {   // well past the hero: the choreography has the line again (hidden until Tracy)
      if (docking) { docking = false; lean = 1; P.set('line.w', 2.4, true); P.set('line.halo', 0.22, true); P.set('line.start', 0, true); P.set('line.draw', 1, true); }
      brand.style.opacity = ''; top.classList.remove('in-hero'); setNav(true); k = 1; docked = true;
      return;
    }
    docking = true; lean = 0;   // the camera holds still in the hero, so the route on screen is exact
    top.classList.toggle('in-hero', hero.getBoundingClientRect().bottom > 70);
    // when: the moment the wordmark would slip under the header (with a little hysteresis on the way back);
    // on phones the wordmark starts right under the header, so there the first real scroll is the moment
    const hb = top.getBoundingClientRect().bottom, st = stage.getBoundingClientRect().top;
    if (!docked && st < hb + 4 && y > 6) docked = true;
    else if (docked && (st > hb + 48 || y <= 2)) docked = false;
    setNav(docked);
    if (app.reduced) k = docked ? 1 : 0;
    else k = clamp(k + (docked ? 1 : -1) * dt / (window.__dockDur || DUR));   // __dockDur: slow it down for stills
    // the hero wordmark's pose, live: what is left of it rides with the page, like the copy around it
    const a = keys[0].set, big = { x: a['line.x'], y: a['line.y'] + y / vh * 2, s: a['line.s'] };
    if (k <= 0) {
      P.set('line.x', big.x, true); P.set('line.y', big.y, true); P.set('line.s', big.s, true); P.set('line.rx', 0, true); P.set('line.ry', 0, true);
      P.set('line.shape', 0, true); P.set('line.start', 0, true); P.set('line.alpha', 1, true); P.set('line.w', 2.4, true); P.set('line.halo', 0.22, true);
      if (moved) P.set('line.draw', 1, true);   // back from a move: the wordmark whole again (before any move, the intro draws it)
      brand.style.opacity = '0';
      return;
    }
    moved = true;
    const V = view(), { ua, ub } = build(big, landing(V), V);
    // the route is laid out in screen space: the line itself sits still, untransformed
    P.set('line.x', 0, true); P.set('line.y', 0, true); P.set('line.s', 1, true); P.set('line.rx', 0, true); P.set('line.ry', 0, true);
    P.set('line.shape', 1, true);
    // the front runs from the big wordmark's last point to the small one's last; the back follows from the big
    // wordmark's first point and clears it and the curve early, so what is left behind is gone before the page can
    // carry it off the screen (the back never overtakes the front: it ends where the small wordmark begins)
    const e = io(seg(k, 0, 0.84));
    P.set('line.start', ub * io(seg(k, 0, 0.4)), true);
    P.set('line.draw', ua + (1 - ua) * e, true);
    P.set('line.w', 2.4 - 1.1 * e, true); P.set('line.halo', 0.22 - 0.1 * e, true);
    const hand = io(seg(k, 0.84, 1));
    P.set('line.alpha', 1 - hand, true);
    brand.style.opacity = hand.toFixed(3);
  }, 6);
}

/* ---------- a shape that is drawn, not morphed into ---------- */
// For a shape with { drawIn: '#section' } the line becomes it out of sight (the chapters before it keep the line hidden
// and already in that shape), and when the section comes up the line traces it from the first point to the last, like
// the intro. Scrolling back above the section and down again draws it again.
function drawIn() {
  if (!line) return;
  XP.shapes.forEach(sp => {
    const el = sp && sp.drawIn && document.querySelector(sp.drawIn); if (!el) return;
    const inView = () => { const r = el.getBoundingClientRect(); return r.top < app.height * 0.72 && r.bottom > app.height * 0.25; };
    let state = inView() ? 'drawn' : 'idle', t0 = 0;   // already on screen at load: the intro draws it
    app.add(t => {
      const r = el.getBoundingClientRect();
      if (state === 'idle' && inView()) { state = 'drawing'; t0 = t; P.set('line.draw', 0, true); }
      if (state === 'drawing') {
        const k = Math.min(1, (t - t0) / (app.reduced ? 0.001 : 2.4)), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        P.set('line.draw', e, true);
        if (k >= 1) state = 'drawn';
      }
      if (state !== 'idle' && r.top > app.height) { state = 'idle'; P.set('line.draw', 1, true); }   // back above it: ready to draw again
    }, 4);
  });
}

/* ---------- touch the line ---------- */
function touch() {
  if (!line) return;
  addEventListener('pointerdown', e => {
    if (e.target.closest('a,button,input,textarea,select,label,summary,details,[data-tracy],.menu,header,form,table')) return;
    const u = line.nearest(e.clientX, e.clientY, app.input.fine ? 60 : 90);
    if (u >= 0) { line.touch(u); field.ring(line.pointAt(u)); root.classList.add('touched'); }
  });
  document.querySelectorAll('[data-trace]').forEach(b => b.addEventListener('click', () => { line.touch(0); field.ring(line.pointAt(0)); }));
}

/* ---------- page UI: menu, contract, wallet, FAQ, forms, Tracy ---------- */
function ui() {
  const menuB = document.querySelector('[data-menu]'), menu = document.getElementById('menu');
  if (menuB && menu) menuB.addEventListener('click', () => {
    const open = menuB.getAttribute('aria-expanded') !== 'true';
    menuB.setAttribute('aria-expanded', String(open)); menu.hidden = !open; root.classList.toggle('menu-open', open);
  });
  document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const a = b.dataset.copy; if (!a) return;
    try { await navigator.clipboard.writeText(a); } catch (e) { const t = document.createElement('textarea'); t.value = a; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    const was = b.textContent; b.textContent = 'Copied'; b.classList.add('ok'); setTimeout(() => { b.textContent = was; b.classList.remove('ok'); }, 1600);
  }));
  document.querySelectorAll('[data-add-wallet]').forEach(b => b.addEventListener('click', async () => {
    const t = C.token;
    if (!t.address) return;
    if (!window.ethereum) { b.textContent = 'No wallet found in this browser'; return; }
    try { await window.ethereum.request({ method: 'wallet_watchAsset', params: { type: 'ERC20', options: { address: t.address, symbol: t.symbol, decimals: t.decimals || 18 } } }); } catch (e) { /* the visitor said no */ }
  }));
  // FAQ search
  const q = document.querySelector('[data-faq-search]');
  if (q) q.addEventListener('input', () => {
    const v = q.value.trim().toLowerCase();
    document.querySelectorAll('.faq details').forEach(d => { const hit = !v || d.dataset.q.includes(v); d.hidden = !hit; if (v && hit) d.open = true; });
  });
  // open the FAQ entry a link points at
  // forms: validated here; this preview has no mail backend, so it says so honestly
  document.querySelectorAll('[data-form]').forEach(f => f.addEventListener('submit', e => {
    e.preventDefault();
    const msg = f.querySelector('.form-msg');
    const bad = [...f.querySelectorAll('[required]')].filter(i => !i.value.trim() || (i.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.value)));
    f.querySelectorAll('[aria-invalid]').forEach(i => i.removeAttribute('aria-invalid'));
    bad.forEach(i => i.setAttribute('aria-invalid', 'true'));
    if (bad.length) { msg.textContent = 'Please fill in ' + bad.map(i => i.name).join(', ') + '.'; msg.className = 'form-msg err'; bad[0].focus(); return; }
    msg.textContent = (C.forms && C.forms.sent) || 'Thanks, we\'ll get back to you.'; msg.className = 'form-msg ok'; f.reset();
  }));
  tracy(); portal(); timelock(); coin(); dotsHero();
}

/* ---------- the places: full round photos that slide in from the right ---------- */
// The section never adds scroll. One place is shown large, the next peeks in at the screen's right edge; a ring drawn
// round the large one fills while it is shown, and when it closes the next slides in to take its place. Hover,
// scrolling it away or a hidden tab hold the ring; the peeking circle or a thumbnail go at once.
function portal() {
  const el = document.querySelector('[data-pt]'); if (!el) return;
  const items = JSON.parse(el.dataset.items), n = items.length;
  const stage = el.querySelector('[data-pt-stage]'), cs = [...el.querySelectorAll('[data-pt-c]')], ring = el.querySelector('[data-pt-ring]');
  const fill = el.querySelector('[data-pt-fill]'), now = el.querySelector('.pt-now'), strip = [...el.querySelectorAll('[data-pt-to]')];
  const T = { n: el.querySelector('[data-pt-n]'), t: el.querySelector('[data-pt-t]'), b: el.querySelector('[data-pt-b]') };
  const md = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  let i = 0, moving = false, hover = false, seen = false, paused = !!app.reduced;
  const off = k => { let d = ((k - i) % n + n) % n; return d === n - 1 ? -1 : d; };   // -1: just left, 0: shown, 1: peeking, 2+: waiting off screen
  const last = cs.map(() => 0);
  // where each slot sits, from the stage's size: shown large left of centre, the next half off the right edge
  function layout(instant) {
    const W = stage.offsetWidth, H = stage.offsetHeight, D = cs[0].offsetWidth, narrow = W < 700;
    const cx = narrow ? W / 2 : Math.max(W * 0.44, D / 2 + 20), cy = H / 2;   // as large as the screen allows, clear of the copy
    const slot = d => d === 0 ? [cx, cy, 1, 1] : d === 1 ? [narrow ? W + D * 0.1 : W - D * 0.02, cy + (narrow ? 0 : D * 0.2), narrow ? 0.36 : 0.4, 1]
      : d === -1 ? [cx - D * 0.55, cy, 0.7, 0] : [W + D * 1.2, cy, 0.4, 1];
    cs.forEach((c, k) => {
      const d = off(k), [x, y, sc, o] = slot(d);
      // a circle that wraps round from the far left to the right goes there unseen
      const jump = instant || (last[k] < 0 && d > 0) || (last[k] > 1 && d > 1);
      c.classList.toggle('no-anim', jump);
      c.style.transform = `translate(${(x - D / 2).toFixed(1)}px, ${(y - D / 2).toFixed(1)}px) scale(${sc})`;
      c.style.opacity = o; c.classList.toggle('is-on', d === 0); c.classList.toggle('is-peek', d === 1);
      c.tabIndex = d === 1 ? 0 : -1;
      if (d === 1) c.setAttribute('aria-label', 'Next place: ' + items[k].t);
      last[k] = d;
    });
    ring.style.transform = `translate(${(cx - D / 2).toFixed(1)}px, ${(cy - D / 2).toFixed(1)}px)`;
    void stage.offsetWidth;   // commit the unseen jumps before transitions come back on
    requestAnimationFrame(() => cs.forEach(c => c.classList.remove('no-anim')));
  }
  const held = () => el.classList.toggle('is-held', paused || hover || !seen || document.hidden);
  const run = () => { el.classList.remove('is-run'); void fill.getBoundingClientRect(); el.classList.add('is-run'); };
  function go(to) {
    if (moving || to === i) return;
    moving = true; i = to;
    el.classList.remove('is-run'); el.classList.add('is-moving');
    now.classList.add('is-out');
    layout(false);
    setTimeout(() => {
      const it = items[to];
      T.n.textContent = String(to + 1).padStart(2, '0'); T.t.textContent = it.t; T.b.innerHTML = md(it.b);
      strip.forEach((b, k) => b.toggleAttribute('aria-current', k === to));
      now.classList.remove('is-out');
    }, app.reduced ? 0 : 450);
    setTimeout(() => { moving = false; el.classList.remove('is-moving'); run(); }, app.reduced ? 0 : 1150);
  }
  fill.addEventListener('animationend', () => go((i + 1) % n));
  cs.forEach((c, k) => c.addEventListener('click', () => { if (off(k) === 1) go(k); }));
  strip.forEach((b, k) => b.addEventListener('click', () => go(k)));
  stage.addEventListener('pointerover', e => { if (e.pointerType === 'mouse' && e.target.closest('.pt-c.is-on')) { hover = true; held(); } });
  stage.addEventListener('pointerout', e => { if (e.target.closest('.pt-c.is-on')) { hover = false; held(); } });
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; held(); }, { threshold: 0.4 }).observe(el);
  document.addEventListener('visibilitychange', held);
  layout(true);
  addEventListener('resize', () => layout(true));
  held(); run();
  window.__portal = { go, get i() { return i; } };   // for stills and QA
}

/* ---------- the token: a coin drawn as a dot screen, turning to the pointer ---------- */
// The coin is painted (disc, rim, light, the mark knocked out) on a small hidden canvas, then redrawn as dots, one per
// cell, sized by how much coin is under it: the same dot language as the tokenize chapter. It turns a little towards
// the pointer; it only redraws while on screen and while something changes.
function coin() {
  const cv = document.querySelector('[data-coin]'); if (!cv) return;
  let blue = colors.blue || '#0657ff'; const S = 380, src = document.createElement('canvas'); src.width = src.height = S;
  const g = src.getContext('2d', { willReadFrequently: true }), o = cv.getContext('2d');
  const mark = new Image(); let ready = false; mark.onload = () => { ready = true; dirty = true; }; mark.src = cv.dataset.mark;
  let seen = false, dirty = true, ax = -0.35, ay = 0, tx = -0.35, ty = 0, size = 0;
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; }, { threshold: 0 }).observe(cv);
  const fit = () => { const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); size = r.width; cv.width = cv.height = Math.round(r.width * dpr); o.setTransform(dpr, 0, 0, dpr, 0, 0); dirty = true; };
  fit(); addEventListener('resize', fit);
  function paint() {
    g.clearRect(0, 0, S, S);
    g.save(); g.translate(S / 2, S / 2); g.rotate(-0.35 + ay * 0.25);
    const sx = Math.max(0.55, Math.cos(ax)), r = S * 0.4;
    g.scale(sx, 1);
    g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.arc(Math.sign(ax || 1) * -r * 0.08 / sx * (1 - sx) * 4, 0, r, 0, 7); g.fill();   // the edge, showing as it turns
    g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r * 0.87, 0, 7); g.stroke();
    if (ready) g.drawImage(mark, -r * 0.3, -r * 0.48, r * 0.6, r * 0.92);
    g.restore(); g.globalCompositeOperation = 'source-over';
    const d = g.getImageData(0, 0, S, S).data;
    o.clearRect(0, 0, size, size);
    const cell = Math.max(7, size / 64), k = S / size;
    for (let y = cell / 2; y < size; y += cell) for (let x = cell / 2; x < size; x += cell) {
      const a = d[(((y * k) | 0) * S + ((x * k) | 0)) * 4 + 3] / 255;
      if (a < 0.04) { o.globalAlpha = 0.13; o.fillStyle = blue; o.beginPath(); o.arc(x, y, 0.9, 0, 7); o.fill(); continue; }
      o.globalAlpha = 1; o.fillStyle = blue;   // flat brand blue: the dots' size alone draws the coin
      o.beginPath(); o.arc(x, y, Math.pow(a, 1.2) * cell * 0.5, 0, 7); o.fill();
    }
    o.globalAlpha = 1;
  }
  app.add((t, dt) => {
    if (!seen) return;
    const I = app.input;
    if (!app.reduced && I.fine && I.moved) { const r = cv.getBoundingClientRect(); tx = Math.max(-1, Math.min(1, (I.x - r.left - r.width / 2) / innerWidth * 2.2)) * 0.75; ty = Math.max(-1, Math.min(1, (I.y - r.top - r.height / 2) / innerHeight * 2)) * 0.6; }
    else if (!app.reduced) { tx = -0.35 + Math.sin(t * 0.4) * 0.25; ty = Math.sin(t * 0.3) * 0.15; }   // touch: a slow idle turn
    const k = 1 - Math.exp(-dt * 4), nx = ax + (tx - ax) * k, ny = ay + (ty - ay) * k;
    if (Math.abs(nx - ax) + Math.abs(ny - ay) > 0.0008) { ax = nx; ay = ny; dirty = true; }
    const col = getComputedStyle(cv).color; if (col !== blue) { blue = col; dirty = true; }   // the world's ink: white on blue, blue on paper
    if (dirty) { paint(); dirty = false; }
  }, 70);
}

/* ---------- a page's opening glyph, as a dot screen the pointer parts ---------- */
// A word, a sign or the mark is painted on a hidden canvas and redrawn as dots (one per cell, sized by coverage). The
// dots grow in from left to right the first time it is seen; near the pointer they shrink and step aside.
function dotsHero() {
  document.querySelectorAll('[data-dots]').forEach(async cv => {
    const S = 420, src = document.createElement('canvas'); src.width = src.height = S;
    const g = src.getContext('2d', { willReadFrequently: true }), o = cv.getContext('2d');
    if (cv.dataset.img) {
      const im = new Image(); im.src = cv.dataset.img; await im.decode().catch(() => {});
      const k = Math.min(S * 0.8 / im.width, S * 0.8 / im.height); g.drawImage(im, (S - im.width * k) / 2, (S - im.height * k) / 2, im.width * k, im.height * k);
    } else {
      await document.fonts.ready;
      const t = cv.dataset.glyph || '·'; let fs = S * 0.9;
      g.font = `500 ${fs}px "Space Grotesk", sans-serif`; const w = g.measureText(t).width; fs = Math.min(fs, fs * S * 0.92 / w);
      g.font = `500 ${fs}px "Space Grotesk", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(t, S / 2, S / 2 + fs * 0.04);
    }
    const data = g.getImageData(0, 0, S, S).data;
    let dots = [], size = 0, cell = 8, seen = false, t0 = -1, col = '';
    const fit = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); size = r.width;
      cv.width = cv.height = Math.round(size * dpr); o.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = Math.max(7, size / 52); dots = [];
      for (let y = cell / 2; y < size; y += cell) for (let x = cell / 2; x < size; x += cell) {
        const a = data[(((y / size * S) | 0) * S + ((x / size * S) | 0)) * 4 + 3] / 255;
        dots.push({ x, y, r: a < 0.04 ? 0 : Math.pow(a, 1.1) * cell * 0.5 });
      }
    };
    fit(); addEventListener('resize', fit);
    new IntersectionObserver(([e]) => { seen = e.isIntersecting; }, { threshold: 0.1 }).observe(cv);
    app.add(t => {
      if (!seen || !size) return;
      if (t0 < 0) t0 = t;   // the first frame it is seen on (the app clock starts after this module is set up)
      const c = getComputedStyle(cv).color; col = c;
      const r = cv.getBoundingClientRect(), I = app.input, live = I.fine && I.moved && !app.reduced;
      const px = I.x - r.left, py = I.y - r.top, R = size * 0.16;
      o.clearRect(0, 0, size, size); o.fillStyle = col;
      for (const d of dots) {
        const grow = app.reduced ? 1 : Math.min(1, Math.max(0, (t - t0 - d.x / size * 0.9) / 0.55)), e = grow * grow * (3 - 2 * grow);
        if (!d.r) { o.globalAlpha = 0.14 * e; o.beginPath(); o.arc(d.x, d.y, 0.9, 0, 7); o.fill(); continue; }
        let x = d.x, y = d.y, rr = d.r * e;
        if (live) {
          const dx = d.x - px, dy = d.y - py, dist = Math.hypot(dx, dy);
          if (dist < R) { const f = 1 - dist / R; rr *= 1 - f * 0.75; x += dx / (dist || 1) * f * cell * 0.9; y += dy / (dist || 1) * f * cell * 0.9; }
        }
        o.globalAlpha = 1; o.beginPath(); o.arc(x, y, rr, 0, 7); o.fill();
      }
      o.globalAlpha = 1;
    }, 71);
  });
}

/* ---------- the Timelock dial: an example proposal counting down, second by second, while it is on screen ---------- */
function timelock() {
  const el = document.querySelector('[data-tl]'); if (!el) return;
  const total = +el.dataset.total, arc = el.querySelector('[data-tl-arc]'), head = el.querySelector('[data-tl-head]'), t = el.querySelector('[data-tl-t]');
  let secs = +el.dataset.secs, seen = false;
  const pad = v => String(v).padStart(2, '0');
  const draw = () => {
    const f = Math.max(0, secs) / total;
    arc.style.strokeDashoffset = (100 - f * 100).toFixed(3);
    head.style.transform = `rotate(${(f * 360).toFixed(2)}deg)`;
    const d = Math.floor(secs / 86400), h = Math.floor(secs % 86400 / 3600), m = Math.floor(secs % 3600 / 60), s = secs % 60;
    t.textContent = `${d ? d + 'd ' : ''}${pad(h)}:${pad(m)}:${pad(s)}`;
  };
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; }, { threshold: 0.2 }).observe(el);
  setInterval(() => { if (seen && !document.hidden && secs > 0) { secs--; draw(); } }, 1000);
  draw();
}

function tracy() {
  const w = document.querySelector('[data-tracy]'); if (!w) return;
  const b = w.querySelector('[data-tracy-toggle]'), panel = w.querySelector('.tracy-panel'), log = w.querySelector('[data-tracy-log]'), form = w.querySelector('[data-tracy-form]');
  const set = open => { b.setAttribute('aria-expanded', String(open)); panel.hidden = !open; w.classList.toggle('is-open', open); if (open) { form.q.focus(); try { localStorage.setItem('tracy-seen', '1'); } catch (e) { /* storage off */ } } };
  try { if (localStorage.getItem('tracy-seen')) w.classList.add('seen'); } catch (e) { /* storage off */ }
  b.addEventListener('click', () => set(panel.hidden));
  w.querySelector('[data-tracy-close]').addEventListener('click', () => { set(false); b.focus(); });
  document.querySelectorAll('[data-tracy-open]').forEach(x => x.addEventListener('click', () => set(true)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { set(false); b.focus(); } });
  const words = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(x => x.length > 2 && !STOP.has(x));
  const STOP = new Set(['the', 'and', 'what', 'how', 'can', 'does', 'who', 'why', 'when', 'where', 'are', 'for', 'with', 'you', 'your', 'this', 'that', 'its', 'tracer', 'there', 'have', 'about', 'get']);
  const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const say = (cls, html) => { const p = document.createElement('div'); p.className = 'msg ' + cls; p.innerHTML = html; log.appendChild(p); log.scrollTop = log.scrollHeight; };
  const ask = text => {
    if (!text.trim()) return;
    say('me', esc(text));
    const qw = words(text);
    let best = null, bs = 0;
    for (const f of C.faq) {
      const fw = words(f.q + ' ' + f.q + ' ' + [].concat(f.a).join(' ') + ' ' + (f.tags || []).join(' '));
      const s = qw.reduce((a, w) => a + (fw.includes(w) ? 1 : fw.some(x => x.startsWith(w.slice(0, 5))) ? 0.5 : 0), 0);
      if (s > bs) { bs = s; best = f; }
    }
    setTimeout(() => {
      if (best && bs >= 1) say('bot', `<b>${esc(best.q)}</b>${[].concat(best.a).map(a => `<p>${esc(a).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[(.+?)\]\((.+?)\)/g, '$1')}</p>`).join('')}<a href="faq.html">More in the FAQ →</a>`);
      else say('bot', esc(C.tracy.fallback));
    }, app.reduced ? 0 : 380);
  };
  form.addEventListener('submit', e => { e.preventDefault(); ask(form.q.value); form.q.value = ''; });
  w.querySelectorAll('[data-tracy-q]').forEach(x => x.addEventListener('click', () => ask(x.textContent)));
}

/* ---------- order ---------- */
ui();
const shaders = app.track('shaders', 1);
await app.load([build()], [3]);
for (const name of X.modules || []) {
  const mod = await import(`../site/${name}.js`);
  if (mod.default) await mod.default(app, { THREE, site: S, experience: X, line, page: PID });
}
const keys = keysOf(XP.keys);
fitStage(keys);
createChoreo(app, keys);
// the first key is where the page starts (so the intro lands on it)
if (keys[0]) for (const [n, v] of Object.entries(keys[0].set)) if (P.has(n)) P.set(n, v, true);
P.set('tone.view', P.get('tone') > 0.5 ? 1 : 0, true);
labels(); touch(); occlusion(); carry(); drawIn(); dock(keys);
window.__trace = { app, line };   // for stills, QA and editors
if (app.gl) { await app.idle(); app.renderer.compile(app.scene, app.camera); }
shaders(1);
if (app.gl && !app.reduced) P.set('line.draw', 0, true);
app.start();
await ld.done();
if (app.gl) {
  // the intro: the line traces the page's first shape, its head glowing, then the signal starts to run
  const dur = PID === 'index' ? 2.6 : 1.6;
  await createSequence(app, [{ at: 0, set: { 'line.draw': 0 } }, { at: dur, set: { 'line.draw': 1 }, ease: 'inOutSine' }]).play();
}
