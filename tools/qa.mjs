#!/usr/bin/env node
/*
 * QA for the built site: every page on desktop (1440×900) and phone (390×844).
 *   node tools/qa.mjs            -> .qa/<page>-<device>.jpg + a report; exits non-zero on any failure
 * Checks: no console errors, no failed requests, no horizontal overflow, one h1, every image has alt text,
 * interactions (phone menu, FAQ search, Tracy answers, contact form validation, the home page's cutter).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist'), OUT = path.join(ROOT, '.qa');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(DIST, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0, '127.0.0.1');
await new Promise(r => server.on('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
fs.mkdirSync(OUT, { recursive: true });
const pages = fs.readdirSync(DIST).filter(f => f.endsWith('.html'));
const browser = await chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu'] });
const fails = [], ok = [];
const check = (cond, msg) => (cond ? ok : fails).push(msg);

for (const device of [{ name: 'desktop', viewport: { width: 1440, height: 900 } }, { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]) {
  const ctx = await browser.newContext({ viewport: device.viewport, isMobile: device.isMobile, hasTouch: device.hasTouch, deviceScaleFactor: 1 });
  for (const file of pages) {
    const page = await ctx.newPage(), errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    page.on('requestfailed', r => errs.push('failed ' + r.url()));
    page.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
    await page.goto(`${base}/${file}?q=high&nodyn`, { waitUntil: 'networkidle' });
    const tag = `${file} (${device.name})`;
    if (file === 'index.html') await page.waitForFunction(() => window.__specimen && window.__studio && window.__studio.ready, null, { timeout: 120000 }).catch(() => errs.push('home never became ready'));
    await page.waitForTimeout(file === 'index.html' ? 3500 : 400);
    const facts = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      h1: document.querySelectorAll('h1').length,
      noAlt: [...document.images].filter(i => !i.hasAttribute('alt')).length,
      brokenImg: [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.loading !== 'lazy').length
    }));
    check(!errs.length, `${tag}: no console errors / failed requests${errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''}`);
    check(facts.overflow <= 1, `${tag}: no horizontal overflow (${facts.overflow}px)`);
    check(facts.h1 === 1, `${tag}: exactly one h1 (${facts.h1})`);
    check(!facts.noAlt && !facts.brokenImg, `${tag}: images load and have alt text`);
    // interactions
    if (device.name === 'phone') {
      await page.click('[data-menu]'); check(await page.isVisible('#menu'), `${tag}: phone menu opens`); await page.click('[data-menu]');
    }
    if (await page.$('[data-faq-search]')) {
      await page.fill('[data-faq-search]', 'delegate');
      const shown = await page.$$eval('.faq details', ds => ds.filter(d => !d.hidden).length);
      check(shown >= 1 && shown < 6, `${tag}: FAQ search filters (${shown} shown)`);
      await page.fill('[data-faq-search]', '');
    }
    if (device.name === 'desktop' && await page.$('[data-tracy-toggle]')) {
      await page.click('[data-tracy-toggle]'); await page.fill('[data-tracy-form] input', 'how do I vote?'); await page.press('[data-tracy-form] input', 'Enter');
      await page.waitForTimeout(500);
      const ans = await page.$eval('[data-tracy-log]', l => l.lastElementChild.textContent);
      check(/delegate/i.test(ans), `${tag}: Tracy answers from the FAQ`);
      await page.click('[data-tracy-close]');
    }
    if (await page.$('[data-form]')) {
      await page.click('[data-form] button[type=submit]');
      check(await page.$eval('[data-form] .form-msg', m => m.classList.contains('err')), `${tag}: contact form validates`);
    }
    if (file === 'index.html' && device.name === 'desktop') {
      // the cutter: the slider changes the cut and the readout
      await page.evaluate(() => { const s = document.getElementById('slice'); scrollTo(0, s.offsetTop + s.offsetHeight * 0.4); });
      await page.waitForTimeout(600);
      await page.$eval('[data-cut-input]', i => { i.value = 250; i.dispatchEvent(new Event('input')); });
      await page.waitForTimeout(1500);
      const r = await page.evaluate(() => ({ kg: document.querySelector('[data-kg]').textContent, len: window.__specimen.app.params.get('cut.len') }));
      check(r.kg === '250' && Math.abs(r.len - 1.1) < 0.02, `${tag}: cutter sets 250 kg (cut.len ${r.len.toFixed(2)})`);
      await page.evaluate(() => scrollTo(0, 0));
    }
    // walk the page once (reveals fire as a reader would see them), then back to the top
    await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } scrollTo(0, 0); });
    await page.waitForTimeout(1200);
    const shot = path.join(OUT, `${file.replace('.html', '')}-${device.name}.jpg`);
    if (file === 'index.html') await page.screenshot({ path: shot, type: 'jpeg', quality: 80 });
    else await page.screenshot({ path: shot, type: 'jpeg', quality: 70, fullPage: true });
    await page.close();
  }
  await ctx.close();
}
await browser.close(); server.close();
console.log(`${ok.length} passed, ${fails.length} failed`);
if (fails.length) { console.log(' - ' + fails.join('\n - ')); process.exitCode = 1; }
