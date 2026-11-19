#!/usr/bin/env node
/*
 * Build the site: content/*.mjs -> dist/ (static, deployable to any host).
 *   node tools/build.mjs
 * Renders every page (src/render), copies the runtime, scripts, styles and assets, writes sitemap.xml and robots.txt,
 * then checks every local link, image and #anchor. Exits non-zero if anything points nowhere.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href + '?t=' + Date.now());
const { site } = await imp('content/site.mjs');
const { specimen } = await imp('content/specimen.mjs');
const { renderSite } = await imp('src/render/index.mjs');
const marks = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/marks.json'), 'utf8'));

const copyDir = (src, dst) => {
  if (!fs.existsSync(src)) return 0; let n = 0;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) n += copyDir(s, d); else { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(s, d); n++; }
  }
  return n;
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const pages = renderSite(site, specimen, marks);
for (const [file, html] of Object.entries(pages)) fs.writeFileSync(path.join(OUT, file), html);
copyDir(path.join(ROOT, 'src/runtime'), path.join(OUT, 'runtime'));
copyDir(path.join(ROOT, 'src/js'), path.join(OUT, 'js'));
copyDir(path.join(ROOT, 'src/styles'), path.join(OUT, 'css'));
copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
fs.copyFileSync(path.join(ROOT, 'assets/mark-blue.svg'), path.join(OUT, 'assets/favicon.svg'));
if (fs.existsSync(path.join(ROOT, 'assets/figures/core.jpg'))) fs.copyFileSync(path.join(ROOT, 'assets/figures/core.jpg'), path.join(OUT, 'assets/og.jpg'));
const urls = Object.keys(pages).map(f => `${site.url}/${f === 'index.html' ? '' : f}`);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), site.noindex ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);

// every local reference must exist; every #anchor must exist on its page
const ids = {}; for (const [f, html] of Object.entries(pages)) ids[f] = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const problems = [];
for (const [f, html] of Object.entries(pages)) {
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(https?:|mailto:|data:)/.test(u) || u === '#') continue;
    const [p, a] = u.split('#');
    const target = p || f;
    if (p && !fs.existsSync(path.join(OUT, p))) { problems.push(`${f}: missing file ${u}`); continue; }
    if (a && pages[target] && !ids[target].has(a)) problems.push(`${f}: missing anchor ${u}`);
  }
  for (const m of html.matchAll(/url\('([^']+)'\)/g)) if (!fs.existsSync(path.join(OUT, m[1]))) problems.push(`${f}: missing ${m[1]}`);
}
for (const m of fs.readFileSync(path.join(OUT, 'css/home.css'), 'utf8').matchAll(/url\('\.\.\/([^']+)'\)/g)) if (!fs.existsSync(path.join(OUT, m[1]))) problems.push(`home.css: missing ${m[1]} (run npm run figures)`);
const tbc = Object.values(pages).reduce((n, h) => n + (h.match(/class="tbc"/g) || []).length, 0);
console.log(`built ${Object.keys(pages).length} pages -> dist/  ·  ${tbc} facts marked TBC`);
if (problems.length) { console.log('problems:\n - ' + [...new Set(problems)].join('\n - ')); process.exitCode = 1; }
