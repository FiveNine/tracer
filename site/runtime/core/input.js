/*
 * Input: pointer, drag with inertia, 3D hover/click, and drawn gestures.
 *
 *   app.input.x/.y (px), .nx/.ny (-1..1, y up), .vx/.vy (px/s), .speed (smoothed), .down, .fine (mouse-like pointer)
 *   app.input.spin(object3D, { axis: 'y', speed: 0.006, inertia: 0.92, bounds: el }) -> { enabled, velocity }
 *   app.input.hover(meshOrList, { enter, leave, click, cursor: 'pointer' })   raycast against the app camera
 *   app.input.gesture({ el, shape: 'circle', onStroke(points), onResult({ ok, score, shape }) })
 *        records a stroke while the pointer is down and recognises it: 'circle' (closure, roundness, sweep),
 *        or any $1-unistroke template you pass as { templates: { name: [[x, y], …] } }.
 */
import * as THREE from 'three';

export function createInput(app) {
  const ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
  const hovers = [], spins = [], gestures = [];
  let lastX = innerWidth / 2, lastY = innerHeight / 2, lastT = performance.now(), hovered = null;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const api = { x: lastX, y: lastY, nx: 0, ny: 0, vx: 0, vy: 0, speed: 0, down: false, fine, moved: false };

  function onMove(e) {
    const now = performance.now(), dt = Math.max(1, now - lastT) / 1000;
    api.vx = (e.clientX - lastX) / dt; api.vy = (e.clientY - lastY) / dt;
    lastX = api.x = e.clientX; lastY = api.y = e.clientY; lastT = now;
    api.nx = (api.x / (app.width || innerWidth)) * 2 - 1; api.ny = -((api.y / (app.height || innerHeight)) * 2 - 1); api.moved = true;
    for (const s of spins) if (s.dragging) { s.vel = (e.clientX - s.lx) * s.speed; s.velY = (e.clientY - s.ly) * s.speed; s.lx = e.clientX; s.ly = e.clientY; s.apply(s.vel, s.velY); }
    for (const g of gestures) if (g.active) { g.points.push([e.clientX, e.clientY]); g.onStroke && g.onStroke(g.points); }
  }
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', e => {
    api.down = true; onMove(e);
    for (const s of spins) if (s.enabled && inside(s.bounds, e)) { s.dragging = true; s.lx = e.clientX; s.ly = e.clientY; s.vel = 0; }
    for (const g of gestures) if (g.enabled && inside(g.el, e)) { g.active = true; g.points = [[e.clientX, e.clientY]]; g.onStart && g.onStart(); }
    if (hovered && hovered.opts.click) hovered.opts.click(hovered.hit, e);
  });
  addEventListener('pointerup', e => {
    api.down = false;
    for (const s of spins) s.dragging = false;
    for (const g of gestures) if (g.active) { g.active = false; const r = recognise(g.points, g); g.onResult && g.onResult(r, g.points); }
  });
  function inside(el, e) { if (!el) return true; const r = el.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }

  api.spin = (obj, o = {}) => {
    const s = { enabled: true, dragging: false, vel: 0, velY: 0, lx: 0, ly: 0, speed: o.speed ?? 0.006, inertia: o.inertia ?? 0.93, axis: o.axis || 'y', tilt: o.tilt || 0, bounds: o.bounds || null,
      apply(dx, dy) { obj.rotation[s.axis] += dx; if (s.tilt) obj.rotation.x = Math.max(-s.tilt, Math.min(s.tilt, obj.rotation.x + dy)); } };
    spins.push(s); return s;
  };
  api.hover = (targets, opts = {}) => { hovers.push({ targets: [].concat(targets), opts }); };
  api.gesture = (o = {}) => { const g = Object.assign({ enabled: true, active: false, points: [], shape: 'circle' }, o); gestures.push(g); return g; };

  api.update = dt => {
    api.speed += (Math.hypot(api.vx, api.vy) - api.speed) * Math.min(1, dt * 6);
    api.vx *= Math.pow(0.02, dt); api.vy *= Math.pow(0.02, dt);
    for (const s of spins) if (!s.dragging && Math.abs(s.vel) > 1e-5) { s.vel *= Math.pow(s.inertia, dt * 60); s.apply(s.vel, 0); }
    if (hovers.length && app.camera && fine) {
      v2.set(api.nx, api.ny); ray.setFromCamera(v2, app.camera);
      let best = null;
      for (const h of hovers) {
        const hit = ray.intersectObjects(h.targets, true)[0];
        if (hit && (!best || hit.distance < best.hit.distance)) best = { h, hit };
      }
      const now = best ? best.h : null;
      if (now !== (hovered && hovered.h)) {
        if (hovered && hovered.opts.leave) hovered.opts.leave(hovered.hit);
        if (best && best.h.opts.enter) best.h.opts.enter(best.hit);
        document.documentElement.style.cursor = best && best.h.opts.cursor !== false ? (best.h.opts.cursor || 'pointer') : '';
      }
      hovered = best ? { h: best.h, hit: best.hit, opts: best.h.opts } : null;
      if (best && best.h.opts.move) best.h.opts.move(best.hit);
    }
  };
  return api;
}

/* ---------- stroke recognition ---------- */
function recognise(pts, g) {
  if (pts.length < 8) return { ok: false, score: 0, shape: null, reason: 'too short' };
  if (g.templates) return dollar(pts, g.templates, g.minScore || 0.8);
  if (g.shape === 'circle') return circle(pts, g);
  return { ok: false, score: 0, shape: null };
}
/** A drawn zero / circle / ring: closed, round, and sweeping most of a turn. Direction and start point free. */
export function circle(pts, o = {}) {
  let cx = 0, cy = 0; for (const p of pts) { cx += p[0]; cy += p[1]; } cx /= pts.length; cy /= pts.length;
  const rs = pts.map(p => Math.hypot(p[0] - cx, p[1] - cy)), mean = rs.reduce((a, b) => a + b, 0) / rs.length;
  const sd = Math.sqrt(rs.reduce((a, r) => a + (r - mean) * (r - mean), 0) / rs.length) / Math.max(1, mean);
  let sweep = 0; for (let i = 1; i < pts.length; i++) { let a = Math.atan2(pts[i][1] - cy, pts[i][0] - cx) - Math.atan2(pts[i - 1][1] - cy, pts[i - 1][0] - cx); if (a > Math.PI) a -= 2 * Math.PI; if (a < -Math.PI) a += 2 * Math.PI; sweep += a; }
  const turns = Math.abs(sweep) / (2 * Math.PI);
  const gap = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) / Math.max(1, mean);
  const minR = o.minRadius || 28;
  // roundness 1 at sd 0 -> 0 at sd 0.45 ; sweep 1 at >= 0.85 turns ; closure 1 at gap <= 0.5 radius
  const round = Math.max(0, 1 - sd / 0.45), sw = Math.min(1, turns / 0.85), close = Math.max(0, Math.min(1, 1.5 - gap));
  const score = round * 0.45 + sw * 0.35 + close * 0.2;
  const ok = mean >= minR && turns >= 0.72 && sd < 0.38 && score >= (o.minScore || 0.72);
  return { ok, score, shape: 'circle', center: [cx, cy], radius: mean, turns, roundness: 1 - sd };
}
/* $1 unistroke recogniser (Wobbrock, Wilson & Li 2007), compact re-implementation */
function resample(pts, n) {
  const I = pathLen(pts) / (n - 1); let D = 0; const out = [pts[0].slice()]; const p = pts.map(q => q.slice());
  for (let i = 1; i < p.length; i++) {
    const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (D + d >= I && d > 0) { const t = (I - D) / d, q = [p[i - 1][0] + t * (p[i][0] - p[i - 1][0]), p[i - 1][1] + t * (p[i][1] - p[i - 1][1])]; out.push(q); p.splice(i, 0, q); D = 0; }
    else D += d;
  }
  while (out.length < n) out.push(p[p.length - 1].slice());
  return out.slice(0, n);
}
function pathLen(p) { let d = 0; for (let i = 1; i < p.length; i++) d += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return d; }
function centroid(p) { let x = 0, y = 0; p.forEach(q => { x += q[0]; y += q[1]; }); return [x / p.length, y / p.length]; }
function rotate(p, a) { const [cx, cy] = centroid(p), c = Math.cos(a), s = Math.sin(a); return p.map(q => [(q[0] - cx) * c - (q[1] - cy) * s + cx, (q[0] - cx) * s + (q[1] - cy) * c + cy]); }
function normalise(pts) {
  let p = resample(pts, 64); const [cx, cy] = centroid(p); p = rotate(p, -Math.atan2(cy - p[0][1], cx - p[0][0]));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; p.forEach(q => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
  const w = Math.max(1e-6, x1 - x0), h = Math.max(1e-6, y1 - y0); p = p.map(q => [q[0] * 250 / w, q[1] * 250 / h]);
  const [mx, my] = centroid(p); return p.map(q => [q[0] - mx, q[1] - my]);
}
function pathDist(a, b) { let d = 0; for (let i = 0; i < a.length; i++) d += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]); return d / a.length; }
function distAtBest(p, t) {
  const phi = 0.5 * (-1 + Math.sqrt(5)); let a = -Math.PI / 4, b = Math.PI / 4;
  let x1 = phi * a + (1 - phi) * b, f1 = pathDist(rotate(p, x1), t), x2 = (1 - phi) * a + phi * b, f2 = pathDist(rotate(p, x2), t);
  while (Math.abs(b - a) > 0.035) { if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = phi * a + (1 - phi) * b; f1 = pathDist(rotate(p, x1), t); } else { a = x1; x1 = x2; f1 = f2; x2 = (1 - phi) * a + phi * b; f2 = pathDist(rotate(p, x2), t); } }
  return Math.min(f1, f2);
}
export function dollar(pts, templates, minScore = 0.8) {
  const p = normalise(pts); let best = null, bd = Infinity;
  for (const name in templates) { const d = distAtBest(p, normalise(templates[name])); if (d < bd) { bd = d; best = name; } }
  const score = 1 - bd / (0.5 * Math.sqrt(2 * 250 * 250));
  return { ok: score >= minScore, score, shape: best };
}
