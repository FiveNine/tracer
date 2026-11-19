/*
 * Server-side rendering of every page (build time, Node). Real HTML for every word: SEO, screen readers, no-JS.
 *   renderSite(site, specimen, marks) -> { 'index.html': html, 'token.html': html, … }
 * The home page is the specimen (live WebGL); the other pages are documents in the same language, illustrated with
 * figures rendered from the same scene (assets/figures, made by tools/figures.mjs).
 */
export const PAGE_IDS = ['index', 'token', 'governance', 'ecosystem', 'base', 'roadmap', 'about', 'faq', 'contact', 'impressum', 'privacy', 'disclaimer'];
const fileOf = id => (id === 'index' ? 'index.html' : id + '.html');

export function renderSite(site, specimen, marks) {
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isExt = h => /^(https?:|mailto:)/.test(h);
  const href = h => {
    if (!h) return '#';
    if (h[0] === '@') { const l = site.links[h.slice(1)]; if (!l) throw new Error('unknown link ' + h); return l.href; }
    if (h[0] === '#' || isExt(h)) return h;
    const [p, a] = h.split('#');
    if (!PAGE_IDS.includes(p)) throw new Error('unknown page ' + h);
    return fileOf(p) + (a ? '#' + a : '');
  };
  const ext = h => (isExt(h) ? ' target="_blank" rel="noopener"' : '');
  const arrow = h => (isExt(h) ? '↗' : '→');
  const tbc = '<span class="tbc" title="To be confirmed by the Tracer team">TBC</span>';
  const md = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, (m, t, h) => { const u = href(h.replace(/&amp;/g, '&')); return `<a href="${esc(u)}"${ext(u)}>${t}</a>`; })
    .replace(/\{tbc\}/g, tbc);
  const paras = t => [].concat(t || []).map(p => `<p>${md(p)}</p>`).join('');
  // headlines: *word* is the accent; split headlines (home, runtime text effects) carry it as data-accent
  const title = (tag, t, attrs = '', split = false) => {
    if (!t) return '';
    if (!split) return `<${tag} ${attrs}>${esc(t).replace(/\*(.+?)\*/g, '<em class="acc">$1</em>').replace(/\{tbc\}/g, tbc)}</${tag}>`;
    const acc = [...String(t).matchAll(/\*(.+?)\*/g)].map(m => m[1]);
    return `<${tag} ${attrs}${acc.length ? ` data-accent="${esc(acc.join('|'))}"` : ''}>${esc(String(t).replace(/\*/g, ''))}</${tag}>`;
  };
  const link = (l, cls = 'ln') => { const u = href(l.href); return `<a class="${cls}" href="${esc(u)}"${ext(u)}>${esc(l.label)}<span aria-hidden="true">${arrow(u)}</span></a>`; };
  const btns = list => (list && list.length ? `<div class="ctas">${list.map((l, i) => link(l, i ? 'btn ghost' : 'btn')).join('')}</div>` : '');
  const svg = (m, cls, label) => `<svg class="${cls}" viewBox="${esc(m.viewBox)}"${label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"'}><path fill="currentColor" fill-rule="evenodd" d="${esc(m.d)}"/></svg>`;
  const T = site.token;
  const chip = (cls = '') => `<div class="chip ${cls}">
      <span class="chip-k">${esc(T.symbol)} · ${esc(T.network)}</span>
      <code class="chip-v">${T.address ? esc(T.address.slice(0, 6) + '…' + T.address.slice(-4)) : esc(T.pending)}</code>
      <button type="button" class="chip-b" data-copy="${esc(T.address)}"${T.address ? '' : ' disabled'} aria-label="Copy the TRCR contract address">Copy</button></div>`;
  const figure = (f, cls = '') => `<figure class="fig ${cls}"><img src="assets/figures/${esc(f.src)}.jpg" alt="${esc(f.alt || f.caption.replace(/^Fig\. \d+\. /, ''))}" width="1600" height="1000" loading="lazy" decoding="async"><figcaption>${md(f.caption)}</figcaption></figure>`;

  /* ---------------- blocks (subpages and the home page's paper sections) ---------------- */
  const faqItems = (s) => {
    let items = site.faq;
    if (s.groups) items = items.filter(f => s.groups.includes(f.group));
    if (s.limit) items = items.slice(0, s.limit);
    const groups = s.grouped ? [...new Set(items.map(f => f.group))] : [null];
    const slug = q => q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
    return `${s.search ? `<label class="faq-search"><span>Search the FAQ</span><input type="search" placeholder="Try “airdrop” or “delegate”" data-faq-search autocomplete="off"></label><p class="faq-none" data-faq-none hidden>No question matches that. Try another word, or ask Tracy.</p>` : ''}
      ${groups.map(g => `${g ? `<h3 class="faq-g" id="${esc(g.toLowerCase())}">${esc(g)}</h3>` : ''}<div class="faq">${items.filter(f => !g || f.group === g).map(f => `
        <details id="q-${slug(f.q)}" data-q="${esc((f.q + ' ' + f.a.join(' ') + ' ' + (f.tags || []).join(' ')).toLowerCase())}"><summary>${esc(f.q)}<i aria-hidden="true"></i></summary><div>${paras(f.a)}</div></details>`).join('')}</div>`).join('')}
      ${s.askTracy ? `<p class="ask">Still stuck? <button type="button" data-tracy-open>Ask ${esc(site.tracy.name)}</button></p>` : ''}`;
  };
  const timeline = (s) => {
    const items = s.compact ? site.roadmap.slice(0, 5) : site.roadmap;
    return `<ol class="timeline${s.compact ? ' compact' : ''}">${items.map(it => `
      <li class="is-${esc(it.state)}"><span class="when">${md(it.when)}</span><span class="dot" aria-hidden="true"></span>
        <div><b>${esc(it.title)}</b><p>${md(it.body)}</p></div><span class="state">${esc({ done: 'Done', now: 'Now', next: 'Next', later: 'Later' }[it.state])}</span></li>`).join('')}</ol>`;
  };
  const BLOCKS = {
    prose: s => `<div class="prose">${[].concat(s.body || []).map(b => typeof b === 'string' ? `<p>${md(b)}</p>` : b.h ? `<h3>${esc(b.h)}</h3>` : b.list ? `<ul>${b.list.map(x => `<li>${md(x)}</li>`).join('')}</ul>` : b.warn ? `<p class="warn"><b>Safety</b>${md(b.warn)}</p>` : '').join('')}</div>`,
    facts: s => `<dl class="facts">${s.items.map(it => `<div${it.contract ? ' class="wide"' : ''}><dt>${esc(it.k)}</dt><dd>${it.contract ? chip('inline') : md(it.v)}${it.note ? `<small>${md(it.note)}</small>` : ''}</dd></div>`).join('')}</dl>
      ${s.wallet ? `<div class="ctas"><button type="button" class="btn ghost" data-add-wallet${T.address ? '' : ' disabled'}>Add ${esc(T.symbol)} to your wallet</button>${T.address ? '' : '<span class="hint">Available once the contract is published.</span>'}</div>` : ''}`,
    steps: s => `<ol class="steps${s.grid ? ' grid' : ''}">${s.items.map((it, i) => `<li><span class="n">${String(i + 1).padStart(2, '0')}</span><b>${esc(it.t)}</b><p>${md(it.d)}</p></li>`).join('')}</ol>`,
    safes: s => `<ol class="safes">${s.items.map((it, i) => `<li><span class="n">${String(i + 1).padStart(2, '0')}</span><b>${esc(it.name)}</b><p>${md(it.purpose)}</p>
      <span class="safe-a">${it.share ? esc(it.share) : 'Allocation ' + tbc}</span><span class="safe-addr">${it.address ? `<a href="${esc(site.links.explorer.href)}/address/${esc(it.address)}" target="_blank" rel="noopener"><code>${esc(it.address.slice(0, 6) + '…' + it.address.slice(-4))}</code> ↗</a>` : '<code>Safe address at launch</code>'}</span></li>`).join('')}</ol>`,
    plates: s => `<ol class="plates">${s.items.map((it, i) => `<li><figure><img src="assets/figures/${esc(it.src)}.jpg" alt="${esc(it.t)}: ${esc(it.d)}" width="1600" height="1000" loading="lazy" decoding="async"><figcaption><span class="n">Fig. ${i + 1}</span><b>${esc(it.t)}</b>${md(it.d)}</figcaption></figure></li>`).join('')}</ol>`,
    cards: s => `<ul class="cards">${s.items.map(it => { const u = href(it.href); return `<li><a href="${esc(u)}"${ext(u)}><span class="status${it.status === 'Live' ? ' live' : ''}">${esc(it.status)}</span><b>${esc(it.title)}</b><span class="d">${md(it.body)}</span><i aria-hidden="true">${arrow(u)}</i></a></li>`; }).join('')}</ul>${s.note ? `<p class="note">${md(s.note)}</p>` : ''}`,
    timeline,
    team: s => `<ul class="team">${s.items.map(it => `<li><span class="avatar" aria-hidden="true"></span><b>${esc(it.name)}</b><span>${md(it.role)}</span></li>`).join('')}</ul>${s.note ? `<p class="note">${md(s.note)}</p>` : ''}`,
    faq: faqItems,
    params: s => `<table class="params"><tbody>${s.rows.map(r => `<tr><th scope="row">${esc(r[0])}</th><td>${md(r[1])}</td></tr>`).join('')}</tbody></table>${s.note ? `<p class="note">${md(s.note)}</p>` : ''}`,
    contact: s => `<div class="contact">
      <form class="form" data-form novalidate>
        <label><span>Name</span><input name="name" autocomplete="name" required></label>
        <label><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
        <label class="wide"><span>Topic</span><select name="topic">${s.topics.map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
        <label class="wide"><span>Message</span><textarea name="message" rows="6" required></textarea></label>
        <button class="btn" type="submit">Send message<span aria-hidden="true">→</span></button>
        <p class="form-msg" role="status" aria-live="polite"></p>
      </form>
      <dl class="channels">${s.channels.map(c => `<div><dt>${esc(c.k)}</dt><dd>${c.href ? `<a href="${esc(href(c.href))}">${esc(c.v)}</a>` : esc(c.v)}</dd></div>`).join('')}</dl></div>`,
    split: s => `<div class="split-links">${s.links.map(l => link(l)).join('')}</div>`
  };
  const section = (s, n, opts = {}) => `
  <section class="sec k-${esc(s.kind)}" id="${esc(s.id)}">
    <div class="rail" aria-hidden="${s.eyebrow ? 'false' : 'true'}"><span class="num">§ ${String(n).padStart(2, '0')}</span>${s.eyebrow ? `<span class="eb">${esc(s.eyebrow)}</span>` : ''}</div>
    <div class="body">
      ${title('h2', s.title, 'class="h2"')}
      ${s.lede ? `<div class="lede">${paras(s.lede)}</div>` : ''}
      ${(BLOCKS[s.kind] || BLOCKS.prose)(s)}
      ${btns(s.ctas)}${s.link ? `<div class="ctas">${link(s.link)}</div>` : ''}
    </div>
  </section>`;

  /* ---------------- chrome ---------------- */
  const header = pid => {
    const a = n => { const u = href(n.href); return `<a href="${esc(u)}"${n.href === pid ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`; };
    return `<a class="skip" href="#main">Skip to content</a>
<header class="top" data-top>
  <nav class="nl" aria-label="Main, part 1">${site.nav.slice(0, 3).map(a).join('')}</nav>
  <a class="brand" href="index.html" aria-label="${esc(site.name)}, home">${svg(marks.word, 'wordmark')}</a>
  <nav class="nr" aria-label="Main, part 2">${site.nav.slice(3).map(a).join('')}<a class="buy" href="${esc(site.links.buy.href)}" target="_blank" rel="noopener">${esc(site.links.buy.label)} ↗</a></nav>
  <button type="button" class="menu-b" aria-expanded="false" aria-controls="menu" data-menu><span></span><span></span><span class="sr">Menu</span></button>
</header>
<div class="menu" id="menu" hidden><nav aria-label="Menu">${site.nav.map(a).join('')}<a href="faq.html">FAQ</a><a href="contact.html">Contact</a></nav>${link(site.links.buy, 'btn')}</div>`;
  };
  const footer = () => `
<footer class="foot">
  <div class="foot-top"><p>${md(site.footer.tagline)}</p>${chip('dark')}</div>
  <div class="foot-cols">${site.footer.columns.map(c => `<div><h2>${esc(c.title)}</h2><ul>${c.links.map(l => { const u = href(l.href); return `<li><a href="${esc(u)}"${ext(u)}>${esc(l.label)}</a></li>`; }).join('')}</ul></div>`).join('')}</div>
  <a class="foot-mark" href="index.html" aria-label="${esc(site.name)}, home">${svg(marks.word, 'wordmark')}</a>
  <div class="foot-small"><span>${md(site.footer.small)}</span><span>${md(site.footer.risk)}</span></div>
</footer>`;
  const tracy = () => {
    const t = site.tracy;
    if (t.embed) return `<script src="${esc(t.embed)}" defer></script>`;
    return `<div class="tracy" data-tracy>
  <button type="button" class="tracy-b" aria-expanded="false" aria-controls="tracy-panel" data-tracy-toggle><span class="tracy-face" aria-hidden="true">${t.avatar ? `<img src="assets/${esc(t.avatar)}" alt="">` : svg(marks.mark, 'tracy-mark')}</span><span class="sr">Ask ${esc(t.name)}</span></button>
  <div class="tracy-panel" id="tracy-panel" role="dialog" aria-label="${esc(t.name)}, ${esc(t.role)}" hidden>
    <div class="tracy-h"><b>${esc(t.name)}</b><span>${esc(t.role)}</span><button type="button" data-tracy-close aria-label="Close">×</button></div>
    <div class="tracy-log" data-tracy-log aria-live="polite"><div class="msg bot">${md(t.greeting)}</div></div>
    <div class="tracy-chips">${t.suggestions.map(q => `<button type="button" data-tracy-q>${esc(q)}</button>`).join('')}</div>
    <form class="tracy-f" data-tracy-form><input name="q" placeholder="${esc(t.placeholder)}" autocomplete="off" aria-label="Your question"><button type="submit" aria-label="Ask">→</button></form>
    <p class="tracy-note">${md(t.note)}</p>
  </div>
</div>`;
  };
  const head = (pid, title_, desc, extra = '') => `<!doctype html>
<html lang="${esc(site.lang)}" class="page-${esc(pid)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title_)}</title>
<meta name="description" content="${esc(desc)}">
${site.noindex ? '<meta name="robots" content="noindex, nofollow">' : ''}
<link rel="canonical" href="${esc(site.url)}/${pid === 'index' ? '' : fileOf(pid)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(title_)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(site.url)}/assets/og.jpg"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#ebe7de">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="assets/fonts/Newsreader-400Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/IBMPlexSans-400Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/fonts/fonts.css">
<link rel="stylesheet" href="css/base.css">
${extra}
</head>`;
  const tail = (extra = '') => `${footer()}
${tracy()}
<script>window.TRACER = ${JSON.stringify({ faq: site.faq, tracy: { fallback: site.tracy.fallback, name: site.tracy.name }, token: { address: T.address, symbol: T.symbol, decimals: T.decimals }, forms: site.forms }).replace(/</g, '\\u003c')};</script>
<script type="module" src="js/site.js"></script>
${extra}
</body>
</html>
`;

  /* ---------------- the home page: the specimen ---------------- */
  const H = site.home;
  const EXTRA = {
    lines: x => `<ol class="lines">${x.items.map(it => { const u = href(it.href); return `<li><a href="${esc(u)}"><span class="k">${esc(it.k)}</span><b>${esc(it.t)}</b><span class="d">${md(it.d)}</span><i aria-hidden="true">→</i></a></li>`; }).join('')}</ol>`,
    cutter: x => `<div class="cutter" data-cutter>
      <div class="cut-read"><div><span>Removed</span><b data-kg>${esc(x.start)}</b><i>kg CO₂</i></div><div><span>Slices of CRRT</span><b data-slices>${esc((x.start * 1000).toLocaleString('en'))}</b><i>1 slice = 1 g</i></div></div>
      <label class="cut-range"><span class="sr">Amount to cut, in kilograms</span><input type="range" min="${esc(x.min)}" max="${esc(x.max)}" step="1" value="${esc(x.start)}" data-cut-input></label>
      <p class="hint">${md(x.hint)}</p></div>`,
    record: x => `<dl class="record">${x.rows.map(r => `<div><dt>${esc(r[0])}</dt><dd>${md(r[1])}</dd></div>`).join('')}</dl>${x.note ? `<p class="hint">${md(x.note)}</p>` : ''}`,
    steps: x => `<ol class="msteps">${x.items.map((s, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span><b>${esc(s.t)}</b><em>${md(s.d)}</em></li>`).join('')}</ol>${x.link ? link(x.link) : ''}`,
    cta: x => `<dl class="mfacts">${x.facts.map(f => `<div><dt>${esc(f[0])}</dt><dd>${md(f[1])}</dd></div>`).join('')}</dl>
      <div class="ctas">${x.links.map((l, i) => link(l, i ? 'ln' : 'btn')).join('')}</div>${chip()}`
  };
  const home = () => {
    const h = H.hero;
    const chapters = H.chapters.map(s => `
  <section class="ch" id="${esc(s.id)}" data-section="${esc(s.id)}" style="--h:${esc(s.height)}vh">
    <div class="copy">
      <p class="num" data-reveal="fade"><span>${esc(s.num)}</span>${esc(s.eyebrow)}</p>
      ${title('h2', s.title, 'data-split="words" data-reveal="rise"', true)}
      ${s.body ? `<div class="mbody" data-reveal="fade" data-delay="120">${paras(s.body)}</div>` : ''}
      ${s.extra ? `<div data-reveal="fade" data-delay="200">${EXTRA[s.extra.kind](s.extra)}</div>` : ''}
    </div>
  </section>`).join('');
    const after = H.after.map((s, i) => section(s, i + 1)).join('');
    const body = `
<body data-page="index">
<div class="loader" aria-hidden="true"><div class="scan"><i></i></div><div class="loader-t"><span>${esc(h.specimen)}</span><b data-loader-pct>00</b></div></div>
<canvas class="gl" aria-hidden="true"></canvas>
<div class="poster" aria-hidden="true"></div>
${header('index')}
<div class="tags" data-tags aria-hidden="true">${H.callouts.map(t => `<span class="tag${t.flip ? ' flip' : ''}" data-tag="${esc(t.id)}" data-on="${esc(t.on)}"><i></i><span>${esc(t.label)}</span></span>`).join('')}</div>
<main id="main">
  <section class="hero" id="hero" data-section="hero">
    <dl class="card" data-reveal="fade" data-reveal-now data-delay="400"><div class="card-h"><dt>${esc(h.specimen)}</dt><dd>CRRT</dd></div>${h.card.map(r => `<div><dt>${esc(r[0])}</dt><dd${r[2] ? ' data-measure' : ''}>${md(r[1])}</dd></div>`).join('')}</dl>
    ${title('h1', h.title, 'data-split="words" data-reveal="rise" data-reveal-now data-delay="200"', true)}
    <div class="aside" data-reveal="fade" data-reveal-now data-delay="600">${paras(h.lede)}${h.links.map(l => link(l)).join('')}</div>
    <p class="scroll-cue" data-reveal="fade" data-reveal-now data-delay="900">${esc(h.cue)}</p>
  </section>${chapters}
  <div class="after">${after}</div>
</main>`;
    const data = `<script>window.SPECIMEN = ${JSON.stringify(specimen).replace(/</g, '\\u003c')};</script>
<script type="module" src="js/home/app.js"></script>`;
    const importMap = `<script type="importmap">${JSON.stringify({ imports: { three: './runtime/vendor/three.module.min.js', 'three/addons/': './runtime/vendor/addons/' } })}</script>
<link rel="stylesheet" href="runtime/dom/fx.css"><link rel="stylesheet" href="css/home.css">`;
    return head('index', H.title, H.description, importMap) + body + tail(data);
  };

  /* ---------------- the document pages ---------------- */
  const page = (pid, pg) => {
    const h = pg.head;
    const body = `
<body data-page="${esc(pid)}">
${header(pid)}
<main id="main">
  <header class="pagehead${h.figure ? ' has-fig' : ''}">
    <div class="ph-copy">
      <p class="eb" data-reveal>${esc(h.eyebrow)}</p>
      ${title('h1', h.title, 'data-reveal')}
      ${h.lede ? `<div class="lede" data-reveal>${paras(h.lede)}</div>` : ''}
      ${btns(h.ctas)}
      ${h.chip ? chip('big') : ''}
    </div>
    ${h.figure ? figure(h.figure, 'ph-fig') : ''}
  </header>
  ${pg.sections.map((s, i) => section(s, i + 1)).join('')}
</main>`;
    return head(pid, pg.title, pg.description) + body + tail();
  };

  const out = { 'index.html': home() };
  for (const [pid, pg] of Object.entries(site.pages)) out[fileOf(pid)] = page(pid, pg);
  return out;
}
