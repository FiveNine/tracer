/*
 * Server-side helpers shared by every template's render.mjs (Node, build time).
 *
 *   import { page, themeVars, esc, attrs } from '../_shared/render-utils.mjs';
 *   export function render(site, ctx) { return page(site, ctx, { body: '…', entry: 'app/app.js' }); }
 *
 * Theme schema (all templates):
 *   "theme": { "mode": "dark" | "light",
 *              "colors": { "bg", "fg", "muted", "line", "accent", "accent2", "surface" },   // any extra keys become --c-<key>
 *              "fonts":  { "sans": {family, package, weights}, "display": {...}, "mono": {...}, "serif": {...} },
 *              "radius": "14px", "css": "extra css" }
 * Every colour becomes a CSS variable (--bg, --fg, --muted, --line, --accent, --accent2, --surface, --c-<extra>),
 * every font role becomes --font-<role> (with sensible fallbacks).
 */
export const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const attrs = o => Object.entries(o).filter(([, v]) => v !== false && v != null).map(([k, v]) => v === true ? ` ${k}` : ` ${k}="${esc(v)}"`).join('');

const FALLBACK = { sans: 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif', display: 'system-ui, sans-serif', mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace', serif: 'Georgia, "Times New Roman", serif', alt: 'Georgia, serif' };
export function themeVars(theme = {}) {
  const c = theme.colors || {}, f = theme.fonts || {}, out = [];
  const base = { bg: '#0b0b0c', fg: '#f1efe9', muted: '#8b8a86', line: 'rgba(255,255,255,.14)', accent: '#ff5a36', accent2: '#ffd166', surface: '#161618' };
  if (theme.mode === 'light') Object.assign(base, { bg: '#f3f0ea', fg: '#141312', muted: '#6d6a64', line: 'rgba(0,0,0,.12)', surface: '#ffffff' });
  const all = Object.assign(base, c);
  for (const k in all) out.push(`--${['bg', 'fg', 'muted', 'line', 'accent', 'accent2', 'surface'].includes(k) ? k : 'c-' + k}: ${all[k]};`);
  for (const role of Object.keys(FALLBACK)) {
    const r = f[role] || (role === 'display' ? f.sans : null);
    out.push(`--font-${role}: ${r ? `"${r.family}", ` : ''}${r && r.fallback ? r.fallback : FALLBACK[role]};`);
  }
  for (const role in f) if (!FALLBACK[role] && f[role] && f[role].family) out.push(`--font-${role}: "${f[role].family}", ${f[role].fallback || FALLBACK.sans};`);
  if (theme.radius) out.push(`--radius: ${theme.radius};`);
  return `:root{${out.join('')}}` + (theme.css ? '\n' + theme.css : '');
}

/** The whole document: head (meta, fonts, runtime css, template css), theme vars, body, SITE data, import map, entry module */
export function page(site, ctx, o) {
  const theme = site.theme || {};
  return `<!doctype html>
<html lang="${esc(site.lang || 'en')}" class="${esc(['theme-' + (theme.mode || 'dark'), 'tpl-' + site.template].concat(o.htmlClass || []).join(' '))}">
<head>
${ctx.head}
<style>${themeVars(theme)}</style>
${site.meta && site.meta.noindex && !/name="robots"/.test(o.headExtra || '') ? '<meta name="robots" content="noindex, nofollow">\n' : ''}${o.headExtra || ''}
${ctx.importMap}
<noscript><style>.loader{display:none!important}[data-reveal],[data-reveal] .u,[data-split] .u{opacity:1!important;transform:none!important;filter:none!important}</style></noscript>
</head>
<body${attrs(o.bodyAttrs || {})}>
${o.body}
${ctx.siteScript}
<script type="module" src="${esc(o.entry || 'app/app.js')}"></script>
</body>
</html>
`;
}

/** common pieces */
export const soundButton = (label = 'sound') => `<button class="sound" type="button" aria-pressed="false" data-cursor="Sound"><span class="sound-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span data-sound-label>${esc(label)} off</span></button>`;
export const posterDiv = src => src ? `<div class="poster" style="background-image:url('${esc(src)}')" aria-hidden="true"></div>` : '';
/** paragraphs: string or [strings] */
export const paras = (t, cls = '') => [].concat(t || []).map(p => `<p${cls ? ` class="${cls}"` : ''}>${esc(p)}</p>`).join('\n');
