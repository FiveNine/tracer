/*
 * The home page: one stone core on a bench; scrolling follows one tonne of carbon removal through its life
 * (measured → endorsed → cut → recorded → retired → governed). The visitor cuts the slice themselves.
 * Direction and keys: content/specimen.mjs · why each thing moves: README.md.
 */
import * as THREE from 'three';
import { createApp } from '../../runtime/core/app.js';
import { createChoreo, createSequence } from '../../runtime/core/choreo.js';
import { studio } from '../../runtime/gfx/studio.js';
import { initText } from '../../runtime/dom/text.js';
import { loader, sectionState } from '../../runtime/dom/ui.js';
import { createBench, L, R } from './scene/bench.js';

const X = window.SPECIMEN, col = X.colors;
const app = createApp({ canvas: '.gl', post: X.look || { preset: 'product' }, clear: col.bg, fov: 22, id: 'tracer' });
const P = app.params;
const ld = loader(app, { min: 900, exit: 900 });
initText(app); sectionState(app);
document.querySelectorAll('[data-accent]').forEach(el => { const w = el.dataset.accent.split('|'); el.querySelectorAll('.u').forEach(u => { if (w.includes(u.textContent.replace(/[.,]/g, ''))) u.classList.add('acc'); }); });
P.defineAll({ 'cam.px': 0.6, 'cam.py': 2.4, 'cam.pz': 9.5, 'cam.tx': 0.4, 'cam.ty': 0.5, 'cam.tz': 0, 'cam.fov': 22, 'cam.shiftX': 0, 'cam.shiftY': 0 });
app.facts = {
  genre: 'specimen (one object on a lab bench)', look: (X.look || {}).preset,
  signature: 'a basalt core is measured by a laser, engraved (endorsed), cut to the gram by the visitor, its grains become its records on Base, and the slice is sealed in a glass Rabbit',
  interactions: ['drag the laser along the core (or the slider) to choose how much to cut'], sound: 'none'
};

let bench = null;
async function build() {
  if (!app.gl) return;
  studio(app, { env: 'softbox', key: { dir: [-1.2, 2.2, 1.4], intensity: 2.6, color: '#fff3e2', shadow: false }, fill: { dir: [1.6, 0.5, 1], intensity: 0.4, color: '#e6ecff' }, rim: { dir: [0.4, 1, -2], intensity: 1.4 },
    ambient: { sky: '#fffaf2', ground: '#bdb4a0', intensity: 0.35 }, contact: { size: 22, y: 0.001, opacity: 0.62, blur: 3.2, darkness: 1.6, height: 2.2, resolution: app.quality === 'low' ? 256 : 1024 } });
  await app.idle();
  const markSvg = await fetch('assets/mark-blue.svg').then(r => r.text());
  const mk = { d: markSvg.match(/ d="([^"]+)"/)[1], vb: markSvg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number) };
  bench = await createBench(app, { experience: X, markSvg: mk, blue: col.accent, laser: col.laser, ink: col.ink, rabbitLabel: X.rabbitLabel });
  await app.idle();
  const v = new THREE.Vector3(); let cx = 0, cy = 0;
  app.add((t, dt) => {
    const k = 1 - Math.exp(-dt * 2.2);
    cx += ((app.reduced ? 0 : app.input.nx * 0.1) - cx) * k; cy += ((app.reduced ? 0 : app.input.ny * 0.05) - cy) * k;   // a small lean: it is a real object
    app.camera.position.set(P.get('cam.px') + cx, P.get('cam.py') + cy, P.get('cam.pz'));
    app.camera.lookAt(v.set(P.get('cam.tx'), P.get('cam.ty'), P.get('cam.tz')));
    if (Math.abs(app.camera.fov - P.get('cam.fov')) > 0.01) { app.camera.fov = P.get('cam.fov'); app.camera.updateProjectionMatrix(); }
    app.camera.setViewOffset(app.width, app.height, -P.get('cam.shiftX') * app.width, -P.get('cam.shiftY') * app.height, app.width, app.height);
  }, 5);
}

/* callouts pinned to the bench: they name what the camera is looking at */
function callouts() {
  const box = document.querySelector('[data-tags]'); if (!box || !bench) return;
  const v = new THREE.Vector3();
  const anchors = {
    scan: () => bench.laser.getWorldPosition(v).add(new THREE.Vector3(0, R + 0.04, 0)),
    face: () => bench.faceCenter(v).add(new THREE.Vector3(0, R + 0.06, 0)),
    cut: () => bench.laser.getWorldPosition(v).add(new THREE.Vector3(0, R + 0.04, 0)),
    ledger: () => bench.blockTop(v),
    rabbit: () => bench.rabbitTop(),
    archive: () => v.set(...(X.archiveTag || [10.2, 0.4, -2.2]))
  };
  const items = [...box.querySelectorAll('[data-tag]')].map(el => ({ el, id: el.dataset.tag, on: el.dataset.on.split(' '), op: -1 }));
  app.add(() => {
    const cur = document.documentElement.dataset.section;
    for (const it of items) {
      const want = it.on.includes(cur) ? 1 : 0;
      if (want) {
        const p = anchors[it.id](); p.project(app.camera); const x = (p.x + 1) / 2 * app.width;
        it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${((1 - p.y) / 2 * app.height).toFixed(1)}px, 0)`;
        if (!it.w) it.w = it.el.querySelector('span').offsetWidth + 70;
        it.el.classList.toggle('flip', x + it.w > app.width - 16 && x - it.w > 16);   // flip to the left only when the left has room
      }
      if (want !== it.op) { it.el.classList.toggle('is-on', !!want); it.op = want; }
    }
  }, 900);
}

/* the cutter: the slider and a drag along the core both choose how much to cut (the whole core is one tonne) */
function cutter() {
  const box = document.querySelector('[data-cutter]'); if (!box) return;
  const input = box.querySelector('[data-cut-input]'), kgEl = box.querySelector('[data-kg]'), slEl = box.querySelector('[data-slices]');
  const fmt = n => Math.round(n).toLocaleString('en');
  const setKg = (kg, fromInput) => {
    kg = Math.max(+input.min, Math.min(+input.max, kg));
    if (!fromInput) input.value = Math.round(kg);
    kgEl.textContent = fmt(kg); slEl.textContent = fmt(kg * 1000);
    const tag = document.querySelector('[data-tag="cut"] span'); if (tag) tag.textContent = 'CUT · ' + fmt(kg) + ' KG';
    P.hold('cut.len', true); P.set('cut.len', kg / 1000 * L);
  };
  input.addEventListener('input', () => setKg(+input.value, true));
  if (!bench) return;
  // drag on the core itself
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R), hit = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let drag = false;
  const at = e => {
    ndc.set(e.clientX / app.width * 2 - 1, -(e.clientY / app.height) * 2 + 1); ray.setFromCamera(ndc, app.camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const local = hit.clone().sub(bench.spec.position).applyAxisAngle(up, -bench.spec.rotation.y);
    return Math.abs(local.z) < R * 2.2 && local.x > -L / 2 - 0.3 && local.x < L / 2 + 0.3 ? (L / 2 - local.x) / L * 1000 : null;
  };
  const inChapter = () => document.documentElement.dataset.section === 'slice';
  addEventListener('pointerdown', e => {
    if (!inChapter() || e.target.closest('a,button,input,label,header,[data-tracy],.copy')) return;
    const kg = at(e); if (kg == null) return; drag = true; setKg(kg); document.documentElement.classList.add('cutting');
  });
  addEventListener('pointermove', e => {
    if (drag) { const kg = at(e); if (kg != null) setKg(kg); return; }
    if (inChapter() && app.input.fine) document.documentElement.classList.toggle('over-core', at(e) != null);
  });
  addEventListener('pointerup', () => { drag = false; document.documentElement.classList.remove('cutting'); });
}

// the hero's words leave before they can slide over the stone
{ const hero = document.querySelector('.hero'); let last = -1; app.add(() => { const k = Math.max(0, Math.min(1, 1 - app.scroll.y / (innerHeight * 0.16))); if (Math.abs(k - last) > 0.005) { hero.style.opacity = k.toFixed(3); hero.style.visibility = k < 0.01 ? 'hidden' : ''; last = k; } }, 30); }

const shaders = app.track('shaders', 1);
await app.load([build()], [4]);
const keys = (X.keys || []).map(k => Object.assign({}, k, { set: Object.assign({}, k.set, app.narrow && k.narrow ? k.narrow : {}) }));
createChoreo(app, keys);
if (keys[0]) for (const [n, v] of Object.entries(keys[0].set)) if (P.has(n)) P.set(n, v, true);
callouts(); cutter();
if (app.gl) { await app.idle(); app.renderer.compile(app.scene, app.camera); }
shaders(1);
app.start();
window.__specimen = { app, bench };
// once the paper sections cover the screen, the bench stops drawing (nothing of it is visible)
const after = document.querySelector('.after');
if (after && app.gl) {
  let running = true;
  const check = () => {
    const covered = after.getBoundingClientRect().top <= 0;
    if (covered && running) { app.stop(); running = false; }
    else if (!covered && !running) { app.start(); running = true; }
  };
  addEventListener('scroll', check, { passive: true }); check();
}
await ld.done();
// the intro is the measurement: the laser runs the length of the core once and the specimen card counts the tonne
const meas = document.querySelector('[data-measure]');
if (meas && app.gl && !app.reduced) {
  const final = meas.textContent;
  P.set('laser.pos', 1, true);
  const tick = () => { const f = 1 - P.get('laser.pos'); meas.textContent = f >= 0.999 ? final : f.toFixed(6) + ' t CO₂'; if (f < 0.999) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
if (app.gl) await createSequence(app, [{ at: 0, set: { 'laser.pos': 1 } }, { at: 2.8, set: { 'laser.pos': 0 }, ease: 'inOutSine' }]).play();
