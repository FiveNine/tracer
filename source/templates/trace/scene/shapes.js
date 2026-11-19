/*
 * The line's shapes: every chapter is one continuous path (strokes joined by invisible travel segments), resampled by
 * arc length to N points so any two shapes morph point for point. Each point is [x, y, z, vis]; vis is the stroke's
 * opacity (0 on travel, < 1 for "planned" parts). Nodes are named 3D points the labels pin to.
 *
 * Drawing language: the logo's own: orthogonal runs with round corners, circles for stations.
 * Units: the view is ~6 units tall at the default camera; shapes fit about 5 x 4 (the wordmark and the wide ones more).
 */

/** polyline with rounded corners (r) */
export function rounded(pts, r, closed = false, seg = 8) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n];
    if (!closed && (i === 0 || i === n - 1)) { out.push(p); continue; }
    const ax = prev[0] - p[0], ay = prev[1] - p[1], bx = next[0] - p[0], by = next[1] - p[1];
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    const rr = Math.min(r, la / 2, lb / 2);
    if (rr < 1e-4) { out.push(p); continue; }
    const s = [p[0] + ax / la * rr, p[1] + ay / la * rr], e = [p[0] + bx / lb * rr, p[1] + by / lb * rr];
    for (let k = 0; k <= seg; k++) {   // quadratic bezier through the corner
      const t = k / seg, u = 1 - t;
      out.push([u * u * s[0] + 2 * u * t * p[0] + t * t * e[0], u * u * s[1] + 2 * u * t * p[1] + t * t * e[1]]);
    }
  }
  if (closed) out.push(out[0]);
  return out;
}

/** circle starting at angle a0, going round (dir 1 = ccw) */
export function circle(cx, cy, r, a0 = Math.PI, dir = -1, seg = 64, turns = 1) {
  const out = [];
  for (let k = 0; k <= seg * turns; k++) { const a = a0 + dir * k / seg * Math.PI * 2; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}

/** go once round a circle and on to an exit angle: enter at aIn, leave at aOut (no chord across the ring) */
export function orbit(cx, cy, r, aIn, aOut, dir = -1, seg = 56) {
  const T = Math.PI * 2, m = v => ((v % T) + T) % T;
  const sweep = T + (dir < 0 ? m(aIn - aOut) : m(aOut - aIn));
  const n = Math.ceil(seg * sweep / T), out = [];
  for (let k = 0; k <= n; k++) { const a = aIn + dir * sweep * k / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}

/** moving-average smoothing inside each visible run (tracing jitter); closed runs wrap round, open ones keep their ends */
function smooth(out, N, passes = 2, w = 3) {
  const runs = [];
  for (let i = 0; i < N;) {
    if (out[i * 4 + 3] === 0) { i++; continue; }
    let j = i; while (j + 1 < N && out[(j + 1) * 4 + 3] !== 0) j++;
    runs.push([i, j]); i = j + 1;
  }
  for (const [a, b] of runs) {
    const n = b - a + 1; if (n < 2 * w + 2) continue;
    const closed = Math.hypot(out[a * 4] - out[b * 4], out[a * 4 + 1] - out[b * 4 + 1]) < 0.02;
    const L = closed ? n - 1 : n;   // a closed run repeats its first point at the end
    let xs = Float32Array.from({ length: L }, (_, k) => out[(a + k) * 4]), ys = Float32Array.from({ length: L }, (_, k) => out[(a + k) * 4 + 1]);
    for (let p = 0; p < passes; p++) {
      const nx = new Float32Array(L), ny = new Float32Array(L);
      for (let k = 0; k < L; k++) {
        let sx = 0, sy = 0, c = 0;
        for (let d = -w; d <= w; d++) { let q = k + d; if (closed) q = (q + L) % L; else if (q < 0 || q >= L) continue; sx += xs[q]; sy += ys[q]; c++; }
        nx[k] = sx / c; ny[k] = sy / c;
      }
      if (!closed) { nx[0] = xs[0]; ny[0] = ys[0]; nx[L - 1] = xs[L - 1]; ny[L - 1] = ys[L - 1]; }
      xs = nx; ys = ny;
    }
    for (let k = 0; k < L; k++) { out[(a + k) * 4] = xs[k]; out[(a + k) * 4 + 1] = ys[k]; }
    if (closed) { out[b * 4] = xs[0]; out[b * 4 + 1] = ys[0]; }
  }
}

function builder() {
  const strokes = [], nodes = {};
  const api = {
    nodes,
    /** add a stroke (array of [x,y] or [x,y,z]); vis 0..1 */
    stroke(pts, vis = 1) { strokes.push({ pts: pts.map(p => [p[0], p[1], p[2] || 0]), vis }); return api; },
    node(id, x, y, z = 0) { nodes[id] = [x, y, z]; return api; },
    build(N) {
      // one list of segments: strokes, and travel between them
      const segs = [];
      let last = null;
      for (const s of strokes) {
        if (last) segs.push({ a: last, b: s.pts[0], vis: 0 });
        for (let i = 0; i < s.pts.length - 1; i++) segs.push({ a: s.pts[i], b: s.pts[i + 1], vis: s.vis });
        last = s.pts[s.pts.length - 1];
      }
      // travel is sampled sparsely (it is invisible), strokes evenly; but every jump gets room for a few samples, or the
      // line would run straight from one stroke's end to the next stroke's start (a drawing with many strokes, like Tracy)
      const len = segs.map(g => Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1], g.b[2] - g.a[2]));
      const visible = len.reduce((a, l, i) => a + (segs[i].vis > 0 ? l : 0), 0);
      const minJump = 4 * visible / N;
      const w = len.map((l, i) => segs[i].vis > 0 ? l : l * 0.08);
      segs.forEach((g, i) => { if (g.vis === 0) w[i] = Math.max(w[i], minJump); });   // a jump is one segment: end -> next start
      const total = w.reduce((a, b) => a + b, 0) || 1;
      const out = new Float32Array(N * 4);
      let si = 0, acc = 0;
      for (let i = 0; i < N; i++) {
        const target = i / (N - 1) * total;
        while (si < segs.length - 1 && acc + w[si] < target) { acc += w[si]; si++; }
        const g = segs[si], t = w[si] > 0 ? Math.min(1, Math.max(0, (target - acc) / w[si])) : 0;
        out[i * 4] = g.a[0] + (g.b[0] - g.a[0]) * t;
        out[i * 4 + 1] = g.a[1] + (g.b[1] - g.a[1]) * t;
        out[i * 4 + 2] = g.a[2] + (g.b[2] - g.a[2]) * t;
        out[i * 4 + 3] = g.vis;
      }
      // the samples either side of a hidden jump sit exactly on the stroke ends, so the fade between a visible
      // and a hidden sample happens over no distance (otherwise a faint diagonal shows across the jump)
      const vis = i => out[i * 4 + 3];
      const snap = (i, j) => { out[i * 4] = out[j * 4]; out[i * 4 + 1] = out[j * 4 + 1]; out[i * 4 + 2] = out[j * 4 + 2]; };
      for (let i = 1; i < N - 1; i++) {
        if (vis(i) === 0 && vis(i - 1) > 0) snap(i, i - 1);
        else if (vis(i) === 0 && vis(i + 1) > 0) snap(i, i + 1);
      }
      if (api.smooth) smooth(out, N, api.smooth);
      return { data: out, nodes };
    }
  };
  return api;
}

/* ---------- the library ---------- */

/** the wordmark's outline (traced from the logo), height h */
function word(marks, h = 1.3) {
  const b = builder(), m = marks.word;
  // outer loop first, then the counters of a and e (left to right)
  const loops = m.loops.slice().sort((p, q) => (p.hole - q.hole) || (Math.min(...p.pts.map(v => v[0])) - Math.min(...q.pts.map(v => v[0]))));
  for (const l of loops) {
    // start each loop at its left-most bottom point so the trace begins at the t's foot
    let k = 0; l.pts.forEach((p, i) => { if (p[0] - p[1] * 0.2 < l.pts[k][0] - l.pts[k][1] * 0.2) k = i; });
    const pts = l.pts.slice(k).concat(l.pts.slice(0, k + 1)).map(p => [p[0] * h, p[1] * h]);
    b.stroke(pts);
  }
  b.node('word', 0, 0);
  b.smooth = 2;
  return b;
}

/** the t mark's outline, height h */
function mark(marks, h = 3) {
  const b = builder(), l = marks.mark.loops[0];
  let k = 0; l.pts.forEach((p, i) => { if (p[1] < l.pts[k][1]) k = i; });
  b.stroke(l.pts.slice(k).concat(l.pts.slice(0, k + 1)).map(p => [p[0] * h, p[1] * h]));
  b.node('mark', 0, 0);
  b.smooth = 2;
  return b;
}

/** Tracy's silhouette (traced from the mascot art), height h; nodes at its box corners place the art over it */
function tracy(marks, h = 3.6) {
  const b = builder(), t = marks.tracy, l = t.loops[0];
  let k = 0; l.pts.forEach((p, i) => { if (p[1] < l.pts[k][1]) k = i; });
  b.stroke(l.pts.slice(k).concat(l.pts.slice(0, k + 1)).map(p => [p[0] * h, p[1] * h]));
  b.node('tracy', 0, 0).node('tl', -t.aspect / 2 * h, h / 2).node('br', t.aspect / 2 * h, -h / 2).node('ear', -t.aspect * 0.22 * h, h * 0.42);
  b.smooth = 2;
  return b;
}

/** Tracy drawn entirely by the line: every stroke of the line-art mascot (vectorised by raw/tracy/tracy-line.py) */
function tracyArt(marks, h = 3.6) {
  const b = builder(), t = marks.tracyArt;
  for (const st of t.strokes) b.stroke(st.map(p => [p[0] * h, p[1] * h]));
  b.node('tracy', 0, 0).node('tl', -t.aspect / 2 * h, h / 2).node('br', t.aspect / 2 * h, -h / 2);
  return b;
}

/** three linked rings: RWA · Base · DAO */
function pillars(ids = ['p1', 'p2', 'p3']) {
  const b = builder(), r = 0.72, gap = 1.75;
  const xs = [-gap, 0, gap];
  const pts = [[-gap - r - 0.5, 0]];
  xs.forEach((x, i) => {
    pts.push([x - r, 0]);
    pts.push(...orbit(x, 0, r, Math.PI, 0, -1, 72));   // round the ring, leave on its right
    b.node(ids[i], x, 0);
  });
  pts.push([gap + r + 0.5, 0]);
  return b.stroke(pts);
}

/** the RWA route: four stations on a stepped path, the last one a closed loop (retired, sealed) */
function route(ids = ['s1', 's2', 's3', 's4']) {
  const b = builder();
  const st = [[-2.1, 1.05], [-0.7, 0.35], [0.7, -0.35], [2.1, -1.05]], r = 0.3;
  const pts = [[-3.0, 1.05]];
  st.forEach((s, i) => {
    pts.push([s[0] - r, s[1]]);
    if (i < 3) {
      pts.push(...orbit(s[0], s[1], r, Math.PI, 0, -1, 48));   // round the station, leave on the right
      const n = st[i + 1];
      const mx = (s[0] + n[0]) / 2;
      pts.push(...rounded([[s[0] + r, s[1]], [mx, s[1]], [mx, n[1]], [n[0] - r, n[1]]], 0.28).slice(1));
    } else {
      pts.push(...circle(s[0], s[1], r, Math.PI, -1, 48, 2));   // the Rabbit: the line closes on itself
    }
    b.node(ids[i], s[0], s[1]);
  });
  return b.stroke(pts);
}

/** a ring with the five Safes: the line loops round each one */
function ring(ids = ['f1', 'f2', 'f3', 'f4', 'f5']) {
  const b = builder(), R = 1.55, r = 0.2, n = ids.length;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI / 2 - i / n * Math.PI * 2, a1 = Math.PI / 2 - (i + 1) / n * Math.PI * 2;
    const cx = Math.cos(a0) * R, cy = Math.sin(a0) * R;
    // the ring arrives just before the Safe, loops round it and leaves just after (clockwise)
    const da = r / R * 1.05;
    const ein = [Math.cos(a0 + da) * R, Math.sin(a0 + da) * R], eout = [Math.cos(a0 - da) * R, Math.sin(a0 - da) * R];
    pts.push(...orbit(cx, cy, r, Math.atan2(ein[1] - cy, ein[0] - cx), Math.atan2(eout[1] - cy, eout[0] - cx), -1, 36));
    for (let k = 0; k <= 40; k++) { const a = a0 - da - (a0 - a1 - 2 * da) * k / 40; pts.push([Math.cos(a) * R, Math.sin(a) * R]); }
    b.node(ids[i], cx, cy);
  }
  pts.push(pts[0]);
  b.stroke(pts);
  b.node('ringc', 0, 0);
  return b;
}

/** the governance loop: a rounded square, four stations at its corners (hold, delegate, vote, execute) */
function loop(ids = ['g1', 'g2', 'g3', 'g4']) {
  const b = builder(), w = 1.9, h = 1.35, r = 0.24;
  const corners = [[-w, h], [w, h], [w, -h], [-w, -h]];
  const pts = [];
  corners.forEach((c, i) => {
    const p = corners[(i + 3) % 4], n = corners[(i + 1) % 4];
    const din = [Math.sign(c[0] - p[0]), Math.sign(c[1] - p[1])], dout = [Math.sign(n[0] - c[0]), Math.sign(n[1] - c[1])];
    // arrive along din, loop the station, leave along dout
    pts.push(...orbit(c[0], c[1], r, Math.atan2(-din[1], -din[0]), Math.atan2(dout[1], dout[0]), -1, 40));
    pts.push([n[0] - dout[0] * r, n[1] - dout[1] * r]);
    b.node(ids[i], c[0], c[1]);
  });
  pts.push(pts[0]);
  return b.stroke(pts);
}

/** Base: blocks in a rising chain; one polyline with every corner rounded (no unrounded turn where a link meets a block) */
function blocks(n = 5, ids) {
  const b = builder(), s = 0.62, gap = 1.02, rise = 0.32, x0 = -(n - 1) / 2 * gap, y0 = -(n - 1) / 2 * rise, h = s / 2;
  const corners = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + i * gap, y = y0 + i * rise;
    // in at the left side, once round, over the top again and out of the right side
    corners.push([x - h, y], [x - h, y + h], [x + h, y + h], [x + h, y - h], [x - h, y - h], [x - h, y + h], [x + h, y + h], [x + h, y]);
    if (i < n - 1) { const mx = x + gap / 2; corners.push([mx, y], [mx, y + rise]); }
    if (ids && ids[i]) b.node(ids[i], x, y);
  }
  b.node('chain', x0 + (n - 1) * gap, y0 + (n - 1) * rise + s);
  return b.stroke(rounded(corners, 0.12, false, 10));
}

/** the ecosystem: a hub (the t's rounded square) and four branches with an endpoint ring each */
function hub(ids = ['e1', 'e2', 'e3', 'e4']) {
  const b = builder(), c = 0.5, rr = 0.22;
  const ends = [[-2.0, 1.25], [2.0, 1.25], [2.0, -1.25], [-2.0, -1.25]];
  const sq = rounded([[-c, 0], [-c, c], [c, c], [c, -c], [-c, -c]], 0.18, true);
  b.stroke([[-c, 0], ...sq.slice(1), [-c, 0]]);
  b.node('hub', 0, 0);
  ends.forEach((e, i) => {
    const sx = Math.sign(e[0]), sy = Math.sign(e[1]);
    const from = [sx * c, sy * c * 0.4];
    const path = rounded([from, [sx * 1.1, from[1]], [sx * 1.1, e[1]], [e[0] - sx * rr, e[1]]], 0.26);
    const ringPts = circle(e[0], e[1], rr, sx > 0 ? Math.PI : 0, sx > 0 ? -1 : 1, 40);
    b.stroke([...path, ...ringPts]);
    b.node(ids[i], e[0], e[1]);
  });
  return b;
}

/** the roadmap: one run with a station per milestone; done ones solid, the rest faint (vertical: top to bottom) */
function timeline(ids, done = 2, vertical = false) {
  const b = builder(), n = ids.length, W = vertical ? 4.6 : 5.6, r = 0.16, x0 = -W / 2;
  const P = (x, y) => vertical ? [y, -x] : [x, y];   // vertical runs downward
  let pts = [P(x0 - 0.5, 0)], vis = 1;
  for (let i = 0; i < n; i++) {
    const x = x0 + i / (n - 1) * W;
    pts.push(P(x - r, 0), ...orbit(x, 0, r, Math.PI, 0, -1, 36).map(q => P(q[0], q[1])));
    const q = P(x, 0); b.node(ids[i], q[0], q[1]);
    if (i === done - 1) {   // "now": the solid part ends here; the future is drawn faint
      b.stroke(pts, 1); pts = [P(x + r + 0.001, 0)]; vis = 0.32;
    }
  }
  pts.push(P(x0 + W + 0.5, 0));
  return b.stroke(pts, vis);
}

/** a calm wave across the page (the quiet chapters) */
function wave() {
  const b = builder(), pts = [];
  for (let k = 0; k <= 200; k++) { const x = -7 + k / 200 * 14; pts.push([x, Math.sin(x * 0.9) * 0.18 + Math.sin(x * 2.3) * 0.05]); }
  return b.stroke(pts, 0.7);
}

/** a straight rule (the subpages' resting state) */
function rule() {
  const b = builder();
  return b.stroke([[-4, 0], [4, 0]], 0.6);
}

export const LIBRARY = { word, mark, tracy, tracyArt, pillars, route, ring, loop, blocks, hub, timeline, wave, rule };

/** build a shape by spec: "route" or { kind: "timeline", ids: [...], done: 2 } */
export function makeShape(spec, marks, N) {
  const s = typeof spec === 'string' ? { kind: spec } : spec;
  const f = LIBRARY[s.kind];
  if (!f) throw new Error('unknown shape ' + s.kind);
  let b;
  if (s.kind === 'word') b = word(marks, s.h);
  else if (s.kind === 'mark') b = mark(marks, s.h);
  else if (s.kind === 'tracy') b = tracy(marks, s.h);
  else if (s.kind === 'tracyArt') b = tracyArt(marks, s.h);
  else if (s.kind === 'timeline') b = timeline(s.ids || ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'], s.done ?? 2, s.vertical);
  else if (s.kind === 'blocks') b = blocks(s.n || 5, s.ids);
  else b = f(s.ids);
  const out = b.build(N);
  // optional placement inside the shape's own frame
  const sc = s.scale || 1, dx = (s.at || [0, 0])[0], dy = (s.at || [0, 0])[1];
  if (sc !== 1 || dx || dy) {
    for (let i = 0; i < N; i++) { out.data[i * 4] = out.data[i * 4] * sc + dx; out.data[i * 4 + 1] = out.data[i * 4 + 1] * sc + dy; }
    for (const k in out.nodes) { const p = out.nodes[k]; out.nodes[k] = [p[0] * sc + dx, p[1] * sc + dy, p[2]]; }
  }
  return out;
}
