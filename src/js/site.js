/*
 * Every page: the header (stuck / hides on scroll down), the phone menu, copying the contract, adding TRCR to a wallet,
 * FAQ search and deep links, the contact form, Tracy (answers from the FAQ, in the browser) and gentle reveals.
 * No dependencies; the home page's WebGL lives in js/home/app.js.
 */
const D = window.TRACER || {}, root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const pageHref = h => /^(https?:|#)/.test(h) ? h : h.replace(/^([a-z]+)(#.*)?$/, (m, p, a) => (p === 'index' ? 'index.html' : p + '.html') + (a || ''));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[(.+?)\]\((.+?)\)/g, (m, t, h) => `<a href="${pageHref(h)}">${t}</a>`).replace(/\{tbc\}/g, '<span class="tbc">TBC</span>');

/* header */
const top = document.querySelector('[data-top]');
if (top) {
  let ref = 0;
  const onScroll = () => {
    const y = scrollY;
    top.classList.toggle('is-stuck', y > 30);
    if (y < innerHeight * 0.5 || root.classList.contains('menu-open')) { top.classList.remove('is-hidden'); ref = y; }
    else if (y - ref > 14) { top.classList.add('is-hidden'); ref = y; }
    else if (ref - y > 14) { top.classList.remove('is-hidden'); ref = y; }
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
}

/* phone menu */
const menuB = document.querySelector('[data-menu]'), menu = document.getElementById('menu');
if (menuB && menu) {
  const set = open => { menuB.setAttribute('aria-expanded', String(open)); menu.hidden = !open; root.classList.toggle('menu-open', open); };
  menuB.addEventListener('click', () => set(menu.hidden));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { set(false); menuB.focus(); } });
  menu.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
}

/* contract */
document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
  const a = b.dataset.copy; if (!a) return;
  try { await navigator.clipboard.writeText(a); } catch (e) { const t = document.createElement('textarea'); t.value = a; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  const was = b.textContent; b.textContent = 'Copied'; b.classList.add('ok'); setTimeout(() => { b.textContent = was; b.classList.remove('ok'); }, 1600);
}));
document.querySelectorAll('[data-add-wallet]').forEach(b => b.addEventListener('click', async () => {
  const t = D.token || {}; if (!t.address) return;
  if (!window.ethereum) { b.textContent = 'No wallet found in this browser'; return; }
  try { await window.ethereum.request({ method: 'wallet_watchAsset', params: { type: 'ERC20', options: { address: t.address, symbol: t.symbol, decimals: t.decimals || 18 } } }); } catch (e) { /* declined */ }
}));

/* FAQ: search, and a link to #q-… opens that answer */
const q = document.querySelector('[data-faq-search]'), none = document.querySelector('[data-faq-none]');
if (q) q.addEventListener('input', () => {
  const v = q.value.trim().toLowerCase(); let n = 0;
  document.querySelectorAll('.faq details').forEach(d => { const hit = !v || d.dataset.q.includes(v); d.hidden = !hit; if (hit) n++; d.open = !!v && hit; });
  document.querySelectorAll('.faq-g').forEach(g => { const list = g.nextElementSibling; g.hidden = list && ![...list.children].some(d => !d.hidden); });
  if (none) none.hidden = n > 0;
});
const openHash = () => { const el = location.hash && document.getElementById(location.hash.slice(1)); if (el && el.tagName === 'DETAILS') el.open = true; };
addEventListener('hashchange', openHash); openHash();

/* contact form: validated here; the preview has no mailbox, and says so */
document.querySelectorAll('[data-form]').forEach(f => f.addEventListener('submit', e => {
  e.preventDefault();
  const msg = f.querySelector('.form-msg');
  const bad = [...f.querySelectorAll('[required]')].filter(i => !i.value.trim() || (i.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.value)));
  f.querySelectorAll('[aria-invalid]').forEach(i => i.removeAttribute('aria-invalid'));
  bad.forEach(i => i.setAttribute('aria-invalid', 'true'));
  if (bad.length) { msg.textContent = 'Please check: ' + bad.map(i => i.name).join(', ') + '.'; msg.className = 'form-msg err'; bad[0].focus(); return; }
  msg.innerHTML = md((D.forms && D.forms.sent) || 'Thanks.'); msg.className = 'form-msg ok'; f.reset();
}));

/* Tracy: answers from the FAQ (a preview until the real assistant is embedded) */
const w = document.querySelector('[data-tracy]');
if (w) {
  const b = w.querySelector('[data-tracy-toggle]'), panel = w.querySelector('.tracy-panel'), log = w.querySelector('[data-tracy-log]'), form = w.querySelector('[data-tracy-form]');
  const set = open => { b.setAttribute('aria-expanded', String(open)); panel.hidden = !open; w.classList.toggle('is-open', open); if (open) form.q.focus(); };
  b.addEventListener('click', () => set(panel.hidden));
  w.querySelector('[data-tracy-close]').addEventListener('click', () => { set(false); b.focus(); });
  document.querySelectorAll('[data-tracy-open]').forEach(x => x.addEventListener('click', () => set(true)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { set(false); b.focus(); } });
  const STOP = new Set(['the', 'and', 'what', 'how', 'can', 'does', 'who', 'why', 'when', 'where', 'are', 'for', 'with', 'you', 'your', 'this', 'that', 'its', 'tracer', 'there', 'have', 'about', 'get', 'is', 'do', 'i']);
  const words = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(x => x.length > 1 && !STOP.has(x));
  const say = (cls, html) => { const p = document.createElement('div'); p.className = 'msg ' + cls; p.innerHTML = html; log.appendChild(p); log.scrollTop = log.scrollHeight; };
  const ask = text => {
    if (!text.trim()) return;
    say('me', esc(text));
    const qw = words(text);
    let best = null, bs = 0;
    // a word in the question counts most, then the tags, then the answer; near-misses (vote/voting) count half
    const hit = (list, x) => list.includes(x) ? 1 : list.some(y => y.length > 3 && x.length > 3 && (y.startsWith(x.slice(0, 4)) || x.startsWith(y.slice(0, 4)))) ? 0.5 : 0;
    for (const f of D.faq || []) {
      const fq = words(f.q), ft = (f.tags || []).map(t => t.toLowerCase()), fa = words(f.a.join(' '));
      const s = qw.reduce((a, x) => a + 3 * hit(fq, x) + 2 * hit(ft, x) + hit(fa, x), 0);
      if (s > bs) { bs = s; best = f; }
    }
    const answer = () => (best && bs >= 2)
      ? say('bot', `<b>${esc(best.q)}</b>${best.a.map(a => `<p>${md(a)}</p>`).join('')}<a href="faq.html#q-${best.q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)}">Open in the FAQ →</a>`)
      : say('bot', md((D.tracy && D.tracy.fallback) || 'Try the FAQ.'));
    reduced ? answer() : setTimeout(answer, 320);
  };
  form.addEventListener('submit', e => { e.preventDefault(); ask(form.q.value); form.q.value = ''; });
  w.querySelectorAll('[data-tracy-q]').forEach(x => x.addEventListener('click', () => ask(x.textContent)));
}

/* reveals on the document pages (the home page's runtime does its own) */
if (document.body.dataset.page !== 'index') {
  const els = document.querySelectorAll('[data-reveal], .sec, .fig');
  if (reduced || !('IntersectionObserver' in window)) els.forEach(e => e.classList.add('is-in'));
  else {
    root.classList.add('reveals');
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
  }
}
