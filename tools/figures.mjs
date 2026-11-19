#!/usr/bin/env node
/*
 * Render the document pages' figures from the home page's own 3D scene (so every picture on the site is the same
 * bench, the same stone, the same light). Build first; needs Playwright (devDependency) and a GPU or SwiftShader.
 *   node tools/figures.mjs            -> assets/figures/<name>.jpg (1600 × 1000)
 * Each figure is a chapter state of the home page, re-centred (no room left for copy) and without any DOM on top.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist'), OUT = path.join(ROOT, 'assets/figures');
// each figure is an exact state of the bench (all params held) seen through its own, centred camera
const BASE = { 'laser.on': 1, 'laser.pos': 0, 'laser.cut': 0, 'engrave': 0, 'cut.open': 0, 'slice.turn': 0, 'ledger.mix': 0, 'ledger.alpha': 1, 'slice.rabbit': 0, 'rabbit.seal': 0, 'archive.show': 0, 'cam.shiftX': 0, 'cam.shiftY': 0 };
const cam = (p, t, fov) => ({ 'cam.px': p[0], 'cam.py': p[1], 'cam.pz': p[2], 'cam.tx': t[0], 'cam.ty': t[1], 'cam.tz': t[2], 'cam.fov': fov });
const FIGURES = [
  { name: 'core', set: { ...BASE, ...cam([0.9, 2.1, 8.4], [0.15, 0.45, 0], 24) } },
  { name: 'face', set: { ...BASE, engrave: 1, ...cam([5.4, 1.15, 1.95], [2.1, 0.55, 0.65], 24) } },
  { name: 'cut', set: { ...BASE, engrave: 1, 'laser.cut': 1, ...cam([1.1, 2.9, 7.6], [0.5, 0.4, 0], 24) } },
  { name: 'ledger', set: { ...BASE, engrave: 1, 'laser.on': 0, 'cut.open': 1, 'slice.turn': 1, 'ledger.mix': 1, ...cam([6.7, 1.95, 7.0], [6.0, 1.15, -0.35], 28) } },
  { name: 'rabbit', set: { ...BASE, engrave: 1, 'laser.on': 0, 'cut.open': 1, 'slice.turn': 1, 'ledger.mix': 1, 'ledger.alpha': 0.3, 'slice.rabbit': 1, 'rabbit.seal': 1, ...cam([10.5, 2.1, 5.5], [9.6, 0.9, 0.7], 28) } },
  { name: 'archive', set: { ...BASE, engrave: 1, 'laser.on': 0, 'cut.open': 1, 'slice.turn': 1, 'ledger.mix': 1, 'ledger.alpha': 0, 'slice.rabbit': 1, 'rabbit.seal': 1, 'archive.show': 1, ...cam([4.6, 18.5, 2.4], [4.6, 0, -3.5], 30) } }
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(DIST, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0, '127.0.0.1');
await new Promise(r => server.on('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('pageerror', e.message));
await page.goto(base + '/index.html?q=high&nodyn', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__specimen && window.__studio && window.__studio.ready, null, { timeout: 120000 });
await page.waitForTimeout(3600);   // the intro (measuring pass) finishes
await page.addStyleTag({ content: 'main, header.top, .tags, .tracy, .foot, .loader, .menu { visibility: hidden !important; }' });
fs.mkdirSync(OUT, { recursive: true });
for (const f of FIGURES) {
  await page.evaluate(f => {
    const { app } = window.__specimen, P = app.params;
    for (const [n, v] of Object.entries(f.set)) { P.hold(n, true); P.set(n, v, true); }
    window.__studio.settle(0, 4);
  }, f);
  await page.screenshot({ path: path.join(OUT, f.name + '.jpg'), type: 'jpeg', quality: 86 });
  console.log('figure', f.name);
}
await browser.close(); server.close();
