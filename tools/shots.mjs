#!/usr/bin/env node
/* Stills of the home page's chapters (settled), for checking compositions.  node tools/shots.mjs [--phone] -> .qa/home-*.jpg */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), DIST = path.join(ROOT, 'dist'), OUT = path.join(ROOT, '.qa');
const phone = process.argv.includes('--phone');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(DIST, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0, '127.0.0.1');
await new Promise(r => server.on('listening', r));
const b = await chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu'] });
const p = await b.newPage(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
await p.goto(`http://127.0.0.1:${server.address().port}/index.html?q=high&nodyn`, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__specimen && window.__studio.ready, null, { timeout: 120000 }); await p.waitForTimeout(3500);
fs.mkdirSync(OUT, { recursive: true });
const at = [['hero', 0], ['lines', 0.45], ['endorse', 0.68], ['slice', 0.4], ['ledger', 0.68], ['retire', 0.66], ['archive', 0.4], ['trcr', 0.4], ['base', 0]];
for (const [id, off] of at) {
  await p.evaluate(([id, off]) => { const el = document.getElementById(id), r = el.getBoundingClientRect(); const y = r.top + scrollY + off * r.height; window.__studio.settle(y, 3); dispatchEvent(new Event('scroll')); }, [id, off]);
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(OUT, `home-${phone ? 'phone' : 'desk'}-${id}.jpg`), type: 'jpeg', quality: 80 });
}
await b.close(); server.close(); console.log('shots done');
