/*
 * trace: a multi-page site drawn by one line of light. render() writes every page as its own HTML file; each page's
 * sections are typed blocks (hero, pillars, steps, facts, safes, cards, timeline, team, faq, params, prose, contact,
 * cta) and each section names the world's tone (blue | paper) and where the line sits (stage).
 * The line's shapes and scroll keys per page live in experience.pages[page].
 */
import { page, esc } from '../_shared/render-utils.mjs';

const PAGES = ['index', 'token', 'governance', 'base', 'ecosystem', 'roadmap', 'about', 'faq', 'contact', 'impressum', 'privacy', 'disclaimer'];
const fileOf = id => id === 'index' ? 'index.html' : id + '.html';

export function validate(site) {
  const p = [], c = site.content || {}, X = site.experience || {};
  if (!c.pages || !c.pages.index) p.push('content.pages.index is required');
  for (const id of Object.keys(c.pages || {})) {
    if (!PAGES.includes(id)) p.push(`content.pages.${id}: unknown page (known: ${PAGES.join(', ')})`);
    const pg = c.pages[id];
    if (!Array.isArray(pg.sections) || !pg.sections.length) p.push(`content.pages.${id}.sections is empty`);
    (pg.sections || []).forEach((s, i) => { if (!s.id) p.push(`content.pages.${id}.sections[${i}].id is required`); });
    const xp = (X.pages || {})[id];
    if (!xp || !Array.isArray(xp.shapes) || !xp.shapes.length) p.push(`experience.pages.${id}.shapes is required`);
  }
  if (!c.token) p.push('content.token is required');
  return p;
}

/* ---------- small pieces ---------- */
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[(.+?)\]\((.+?)\)/g, (m, t, h) => `<a href="${h}"${/^https?:/.test(h) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`).replace(/\{tbc\}/g, '<span class="tbc">to be confirmed</span>');
const paras = (t, cls = '') => [].concat(t || []).map(p => `<p${cls ? ` class="${cls}"` : ''}>${md(p)}</p>`).join('');
const href = (h, c) => {
  if (!h) return '#';
  if (h.startsWith('@')) { const k = h.slice(1); return (c.links[k] && c.links[k].href) || '#'; }
  if (PAGES.includes(h.split('#')[0])) { const [p, a] = h.split('#'); return fileOf(p) + (a ? '#' + a : ''); }
  return h;
};
const ext = h => /^https?:/.test(h) ? ' target="_blank" rel="noopener"' : '';
const btn = (b, c, cls = 'btn') => { const h = href(b.href, c); return `<a class="${cls}${b.ghost ? ' ghost' : ''}" href="${esc(h)}"${ext(h)} data-magnetic>${esc(b.label)}${/^https?:/.test(h) ? '<i aria-hidden="true">↗</i>' : '<i aria-hidden="true">→</i>'}</a>`; };
const ctas = (list, c) => list && list.length ? `<div class="ctas" data-reveal="fade" data-delay="200">${list.map(b => btn(b, c)).join('')}</div>` : '';
const svgOf = (m, cls, label) => m ? `<svg class="${cls}" viewBox="${esc(m.viewBox)}" role="img" aria-label="${esc(label)}"><path fill="currentColor" fill-rule="evenodd" d="${esc(m.d)}"/></svg>` : esc(label);

function contractChip(c, cls = '') {
  const t = c.token, a = t.address;
  return `<div class="chip ${cls}" data-contract>
    <span class="chip-k">${esc(t.symbol)} on ${esc(t.network)}</span>
    <code class="chip-v" data-addr="${esc(a || '')}">${a ? esc(a.slice(0, 6) + '…' + a.slice(-4)) : esc(t.addressPending || 'Contract published at launch')}</code>
    <button type="button" class="chip-b" data-copy="${esc(a || '')}" ${a ? '' : 'disabled'} aria-label="Copy the contract address">Copy</button>
  </div>`;
}

function head(s, tag = 'h2') {
  return `${s.eyebrow ? `<p class="eyebrow" data-reveal="fade">${esc(s.eyebrow)}</p>` : ''}
    ${s.title ? `<${tag} data-split="words" data-reveal="rise">${esc(s.title)}</${tag}>` : ''}
    ${s.lede ? `<div class="lede" data-reveal="fade" data-delay="120">${paras(s.lede)}</div>` : ''}`;
}

/* ---------- section kinds ---------- */
const KINDS = {
  hero(s, c, pid) {
    return `${s.stageBox ? '<div class="hero-stage" data-stage aria-hidden="true"></div>' : ''}${head(s, 'h1')}
      ${ctas(s.ctas, c)}
      ${s.chip ? contractChip(c, 'hero-chip') : ''}
      ${s.trace ? `<button type="button" class="trace-btn" data-trace>${esc(s.trace)}</button>` : ''}`;
  },
  pillars(s, c) {
    return `${head(s)}<ol class="pillars">${s.items.map((it, i) => `
      <li data-reveal="rise" data-delay="${120 + i * 90}"><a href="${esc(href(it.href, c))}">
        <span class="n">0${i + 1}</span><b>${esc(it.title)}</b><span>${md(it.body)}</span><i aria-hidden="true">→</i></a></li>`).join('')}</ol>`;
  },
  steps(s, c) {
    return `${head(s)}<ol class="steps">${s.items.map((it, i) => `
      <li data-reveal="fade" data-delay="${100 + i * 80}"><span class="n">${String(i + 1).padStart(2, '0')}</span>
        <div><b>${esc(it.title)}</b>${paras(it.body)}</div></li>`).join('')}</ol>${ctas(s.ctas, c)}`;
  },
  facts(s, c) {
    return `${head(s)}<dl class="facts">${s.items.map((it, i) => `
      <div data-reveal="fade" data-delay="${80 + i * 60}"><dt>${esc(it.k)}</dt><dd>${it.contract ? contractChip(c, 'inline') : md(it.v)}${it.note ? `<small>${md(it.note)}</small>` : ''}</dd></div>`).join('')}</dl>
      ${s.wallet ? `<div class="ctas" data-reveal="fade"><button type="button" class="btn ghost" data-add-wallet ${c.token.address ? '' : 'disabled'}>Add ${esc(c.token.symbol)} to your wallet</button></div>` : ''}${ctas(s.ctas, c)}`;
  },
  safes(s, c) {
    return `${head(s)}<ul class="safes">${s.items.map((it, i) => `
      <li data-reveal="fade" data-delay="${80 + i * 60}"><span class="n">0${i + 1}</span><b>${esc(it.name)}</b><span>${md(it.purpose)}</span>
        <span class="safe-meta"><em>${it.share ? esc(it.share) : 'Allocation <span class="tbc">to be confirmed</span>'}</em>
        ${it.address ? `<a href="${esc((c.links.explorer && c.links.explorer.href || 'https://basescan.org') + '/address/' + it.address)}" target="_blank" rel="noopener"><code>${esc(it.address.slice(0, 6) + '…' + it.address.slice(-4))}</code> ↗</a>` : '<code>Safe address published at launch</code>'}</span></li>`).join('')}</ul>`;
  },
  cards(s, c) {
    return `${head(s)}<ul class="cards">${s.items.map((it, i) => { const h = href(it.href, c); return `
      <li data-reveal="rise" data-delay="${100 + i * 80}"><a href="${esc(h)}"${ext(h)}>
        <span class="status ${it.status === 'Live' ? 'live' : ''}">${esc(it.status || '')}</span>
        <b>${esc(it.title)}</b><span>${md(it.body)}</span><i aria-hidden="true">${/^https?:/.test(h) ? '↗' : '→'}</i></a></li>`; }).join('')}</ul>${s.note ? `<p class="note" data-reveal="fade">${md(s.note)}</p>` : ''}`;
  },
  timeline(s, c) {
    return `${head(s)}<ol class="timeline">${s.items.map((it, i) => `
      <li class="is-${esc(it.state || 'next')}" data-reveal="fade" data-delay="${80 + i * 60}">
        <span class="when">${esc(it.when || '')}</span><span class="dot" aria-hidden="true"></span>
        <div><b>${esc(it.title)}</b>${paras(it.body)}<span class="state">${esc({ done: 'Done', now: 'Now', next: 'Next', later: 'Later' }[it.state || 'next'])}</span></div></li>`).join('')}</ol>${ctas(s.ctas, c)}`;
  },
  team(s, c) {
    return `${head(s)}<ul class="team">${s.items.map((it, i) => `
      <li data-reveal="fade" data-delay="${80 + i * 60}"><span class="avatar" aria-hidden="true">${esc((it.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2))}</span>
        <b>${esc(it.name)}</b><span>${md(it.role)}</span></li>`).join('')}</ul>${s.note ? `<p class="note" data-reveal="fade">${md(s.note)}</p>` : ''}${ctas(s.ctas, c)}`;
  },
  faq(s, c) {
    let items = c.faq;
    if (s.groups) items = items.filter(f => s.groups.includes(f.group));
    if (s.limit) items = items.slice(0, s.limit);
    const groups = s.grouped ? [...new Set(items.map(f => f.group))] : [null];
    return `${head(s)}${s.search ? `<label class="faq-search" data-reveal="fade"><span>Search the FAQ</span><input type="search" placeholder="Try “airdrop” or “delegate”" data-faq-search></label>` : ''}
      ${groups.map(g => `${g ? `<h3 class="faq-g" id="faq-${esc(g.toLowerCase())}">${esc(g)}</h3>` : ''}
      <div class="faq">${items.filter(f => !g || f.group === g).map(f => `
        <details data-reveal="fade" data-q="${esc((f.q + ' ' + [].concat(f.a).join(' ')).toLowerCase())}"><summary>${esc(f.q)}<i aria-hidden="true"></i></summary><div>${paras(f.a)}</div></details>`).join('')}</div>`).join('')}
      ${s.askTracy ? `<p class="ask" data-reveal="fade">Still stuck? <button type="button" data-tracy-open>Ask ${esc(c.tracy.name)}</button></p>` : ''}${ctas(s.ctas, c)}`;
  },
  params(s, c) {
    return `${head(s)}<table class="params" data-reveal="fade"><tbody>${s.rows.map(r => `<tr><th scope="row">${esc(r[0])}</th><td>${md(r[1])}</td></tr>`).join('')}</tbody></table>${s.note ? `<p class="note">${md(s.note)}</p>` : ''}${ctas(s.ctas, c)}`;
  },
  prose(s, c) {
    return `${head(s)}<div class="prose" data-reveal="fade">${[].concat(s.body || []).map(b => typeof b === 'string' ? `<p>${md(b)}</p>` : b.h ? `<h3>${esc(b.h)}</h3>` : b.list ? `<ul>${b.list.map(x => `<li>${md(x)}</li>`).join('')}</ul>` : '').join('')}</div>${ctas(s.ctas, c)}`;
  },
  contact(s, c) {
    return `${head(s)}<div class="contact-grid">
      <form class="form" data-form novalidate>
        <label><span>Name</span><input name="name" autocomplete="name" required></label>
        <label><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
        <label><span>Topic</span><select name="topic">${(s.topics || ['General']).map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
        <label class="wide"><span>Message</span><textarea name="message" rows="5" required></textarea></label>
        <button class="btn" type="submit">Send message<i aria-hidden="true">→</i></button>
        <p class="form-msg" role="status" aria-live="polite"></p>
      </form>
      <ul class="channels">${(s.channels || []).map(ch => { const h = href(ch.href, c); return `<li><span>${esc(ch.k)}</span><a href="${esc(h)}"${ext(h)}>${esc(ch.v)}</a></li>`; }).join('')}</ul>
    </div>`;
  },
  cta(s, c) {
    return `${head(s)}${ctas(s.ctas, c)}${s.chip ? contractChip(c) : ''}`;
  }
};

function section(s, c, pid) {
  const f = KINDS[s.kind] || KINDS.prose;
  const stage = s.stage || 'none';
  return `<section class="sec k-${esc(s.kind)} stage-${esc(stage)}${s.full ? ' full' : ''}" id="${esc(s.id)}" data-section="${esc(s.id)}" data-tone="${esc(s.tone || 'paper')}">
    <div class="sec-in">${f(s, c, pid)}</div>
  </section>`;
}

function header(site, c, pid) {
  const b = site.brand || {};
  const nav = c.nav.map(n => `<a href="${esc(href(n.href, c))}"${n.href === pid ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`).join('');
  const buy = c.links.buy;
  const an = c.announce;
  return `${an ? `<a class="announce" href="${esc(href(an.href, c))}"><b>${esc(an.label)}</b><span>${esc(an.text)}</span><i aria-hidden="true">→</i></a>` : ''}<header class="top${an ? ' has-announce' : ''}" data-top>
    <a class="brand" href="index.html" aria-label="${esc(b.name)} home">${svgOf(b.wordmark, 'wordmark', b.name)}</a>
    <nav class="nav" aria-label="Main">${nav}</nav>
    <a class="btn small buy" href="${esc(buy.href)}"${ext(buy.href)} data-magnetic>${esc(buy.label)}<i aria-hidden="true">↗</i></a>
    <button type="button" class="menu-b" aria-expanded="false" aria-controls="menu" data-menu><span></span><span></span><span class="sr">Menu</span></button>
  </header>
  <div class="menu" id="menu" hidden><nav aria-label="Menu">${nav}<a href="faq.html">FAQ</a><a href="contact.html">Contact</a></nav>
    <a class="btn" href="${esc(buy.href)}"${ext(buy.href)}>${esc(buy.label)}<i aria-hidden="true">↗</i></a></div>`;
}

function footer(site, c) {
  const b = site.brand || {}, f = c.footer;
  return `<footer class="foot" id="footer" data-section="footer" data-tone="blue">
    <div class="foot-top">
      <a class="foot-mark" href="index.html" aria-label="${esc(b.name)} home">${svgOf(b.wordmark, 'wordmark', b.name)}</a>
      <p>${md(f.tagline)}</p>
      ${contractChip(c, 'foot-chip')}
    </div>
    <div class="foot-cols">${f.columns.map(col => `<div><h4>${esc(col.title)}</h4><ul>${col.links.map(l => { const h = href(l.href, c); return `<li><a href="${esc(h)}"${ext(h)}>${esc(l.label)}</a></li>`; }).join('')}</ul></div>`).join('')}</div>
    <div class="foot-small"><span>${md(f.small)}</span><span>${md(f.risk)}</span></div>
  </footer>`;
}

function tracy(c) {
  const t = c.tracy;
  return `<div class="tracy" data-tracy>
    <button type="button" class="tracy-b" aria-expanded="false" aria-controls="tracy-panel" data-tracy-toggle data-cursor="Ask">
      ${t.hello ? `<span class="tracy-hi" aria-hidden="true">${esc(t.hello)}</span>` : ''}<span class="tracy-face" aria-hidden="true">${t.avatar ? `<img src="assets/${esc(t.avatar)}" alt="">` : '<b>t</b>'}</span><span class="sr">Ask ${esc(t.name)}</span></button>
    <div class="tracy-panel" id="tracy-panel" role="dialog" aria-label="${esc(t.name)}" hidden>
      <div class="tracy-h"><b>${esc(t.name)}</b><span>${esc(t.role)}</span><button type="button" data-tracy-close aria-label="Close">×</button></div>
      <div class="tracy-log" data-tracy-log aria-live="polite"><p class="msg bot">${md(t.greeting)}</p></div>
      <div class="tracy-chips">${t.suggestions.map(q => `<button type="button" data-tracy-q>${esc(q)}</button>`).join('')}</div>
      <form class="tracy-f" data-tracy-form><input name="q" placeholder="${esc(t.placeholder)}" autocomplete="off" aria-label="Your question"><button type="submit" aria-label="Ask">→</button></form>
      <p class="tracy-note">${md(t.note)}</p>
    </div>
  </div>`;
}

export function render(site, ctx) {
  const c = site.content, b = site.brand || {}, out = {};
  for (const pid of Object.keys(c.pages)) {
    const pg = c.pages[pid];
    const tone0 = (pg.sections[0] && pg.sections[0].tone) || 'paper';
    const body = `
<div class="loader" aria-hidden="true"><div class="loader-in"><span>${esc(b.name)}</span><b data-loader-pct>00</b></div></div>
<canvas class="gl" aria-hidden="true"></canvas>
<div class="nogl-mark" aria-hidden="true">${svgOf(pid === 'index' ? b.wordmark : b.mark, 'nogl-svg', '')}</div>
<a class="skip" href="#main">Skip to content</a>
${header(site, c, pid)}
<div class="tags" data-tags aria-hidden="true">${(pg.art || []).map(a => `<div class="art" data-art data-k="${esc(a.k)}" style="-webkit-mask-image:url(assets/${esc(a.src)});mask-image:url(assets/${esc(a.src)})"></div>`).join('')}${(pg.tags || []).map(t => `<span class="tag${t.flip ? ' flip' : ''}${t.pos ? ' ' + esc(t.pos) : ''}" data-tag="${esc(t.id)}" data-k="${esc(t.k)}"><i></i><span class="tag-l">${esc(t.label)}</span></span>`).join('')}</div>
<main id="main" class="page-${esc(pid)}">${pg.sections.map(s => section(s, c, pid)).join('')}</main>
${footer(site, c)}
${tracy(c)}`;
    const html = page(site, Object.assign({}, ctx, { head: ctx.headTags({ title: pg.title, description: pg.description }) }), {
      body, htmlClass: ['tone-' + tone0], bodyAttrs: { 'data-page': pid }
    });
    out[fileOf(pid)] = html.replace('<html ', `<html style="--k:${tone0 === 'paper' ? 1 : 0}" `);
  }
  return out;
}
