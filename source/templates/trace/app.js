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
initText(app); cursor(app); autoHide(app, '[data-top]');
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
    if (sp && sp.photo) jobs.push(createTokenize(app, line, { k, src: 'assets/' + sp.photo, el: document.querySelector('[data-tok]'), from: sp.from, to: sp.to, nFrom: sp.nFrom, nTo: sp.nTo, blue: colors.blue, paper: colors.paper }));
  });
  await Promise.all(jobs);
  app.camera.position.set(0, 0, 11.3);
  // a breath of depth: the camera leans with the pointer
  let cx = 0, cy = 0;
  app.add((t, dt) => {
    const k = 1 - Math.exp(-dt * 2.5);
    cx += ((app.reduced ? 0 : app.input.nx * 0.22) - cx) * k; cy += ((app.reduced ? 0 : app.input.ny * 0.14) - cy) * k;
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
    const target = 1 - 0.82 * Math.min(1, Math.max(0, (cover - 0.03) / 0.22));
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
  };
  fit();
  app.onMeasure(fit);   // before the choreography re-reads its keys (it measures after this)
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
  // a hint of the hand: the cursor says "Touch" near the line
  const cur = document.querySelector('.cursor');
  if (cur && app.input.fine) {
    let near = false, t0 = 0;
    app.add(t => {
      if (t - t0 < 0.12) return; t0 = t;
      const over = document.elementFromPoint(app.input.x, app.input.y);
      const free = !over || !over.closest('a,button,input,textarea,select,summary,[data-tracy],header');
      const n = free && line.nearest(app.input.x, app.input.y, 44) >= 0;
      if (n !== near) { near = n; cur.classList.toggle('has-label', n); cur.classList.toggle('is-link', n); const l = cur.querySelector('span'); if (l) l.textContent = n ? 'Touch' : ''; }
    }, 60);
  }
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
  tracy(); portal();
}

/* ---------- the places: full round photos that slide in from the right ---------- */
// The section never adds scroll. One place is shown large, the next peeks in at the screen's right edge; a ring drawn
// round the large one fills while it is shown, and when it closes the next slides in to take its place. Hover,
// scrolling it away, a hidden tab or the pause button hold the ring; the peeking circle or a thumbnail go at once.
function portal() {
  const el = document.querySelector('[data-pt]'); if (!el) return;
  const items = JSON.parse(el.dataset.items), n = items.length;
  const stage = el.querySelector('[data-pt-stage]'), cs = [...el.querySelectorAll('[data-pt-c]')], ring = el.querySelector('[data-pt-ring]');
  const fill = el.querySelector('[data-pt-fill]'), now = el.querySelector('.pt-now'), strip = [...el.querySelectorAll('[data-pt-to]')], pause = el.querySelector('[data-pt-pause]');
  const T = { n: el.querySelector('[data-pt-n]'), t: el.querySelector('[data-pt-t]'), b: el.querySelector('[data-pt-b]'), credit: el.querySelector('[data-pt-credit]') };
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
      T.n.textContent = String(to + 1).padStart(2, '0'); T.t.textContent = it.t; T.b.innerHTML = md(it.b); T.credit.innerHTML = md(it.credit || '');
      strip.forEach((b, k) => b.toggleAttribute('aria-current', k === to));
      now.classList.remove('is-out');
    }, app.reduced ? 0 : 450);
    setTimeout(() => { moving = false; el.classList.remove('is-moving'); run(); }, app.reduced ? 0 : 1150);
  }
  fill.addEventListener('animationend', () => go((i + 1) % n));
  cs.forEach((c, k) => c.addEventListener('click', () => { if (off(k) === 1) go(k); }));
  strip.forEach((b, k) => b.addEventListener('click', () => go(k)));
  pause.addEventListener('click', () => { paused = !paused; pause.setAttribute('aria-pressed', String(paused)); pause.setAttribute('aria-label', paused ? 'Play the slideshow' : 'Pause the slideshow'); held(); });
  stage.addEventListener('pointerover', e => { if (e.pointerType === 'mouse' && e.target.closest('.pt-c.is-on')) { hover = true; held(); } });
  stage.addEventListener('pointerout', e => { if (e.target.closest('.pt-c.is-on')) { hover = false; held(); } });
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; held(); }, { threshold: 0.4 }).observe(el);
  document.addEventListener('visibilitychange', held);
  layout(true);
  addEventListener('resize', () => layout(true));
  held(); run();
  window.__portal = { go, get i() { return i; } };   // for stills and QA
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
labels(); touch(); occlusion();
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
