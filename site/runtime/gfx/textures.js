/*
 * Procedural, tileable material textures — no image files, no licences, any colour.
 *
 *   const t = await texture('cork', { size: 1024, colors: ['#b8783f', '#8a5228', '#d69a5c'], seed: 3 });
 *   material.map = t.map; material.normalMap = t.normal; material.roughnessMap = t.rough;
 *
 * Kinds: cork · wood · paper · mat (self-healing cutting mat with grid + numbers) · concrete · brushed (metal) ·
 *        fabric · terrazzo · speckle (plastic/ceramic glaze) · grain (fine noise)
 * Every kind returns { map (sRGB), normal (linear), rough (linear, single channel in G), height (Float32Array) }.
 * Generation is chunked (await between rows) so a loader keeps animating; sizes: 512 (props) … 2048 (hero close-ups).
 */
import * as THREE from 'three';

/* ---------- tileable noise ---------- */
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e7) / 1e7; }; }
function makeNoise(seed) {
  const R = rng(seed * 9301 + 49297), perm = new Uint8Array(512), val = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; val[i] = R(); }
  for (let i = 255; i > 0; i--) { const j = (R() * (i + 1)) | 0; const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const h = (x, y) => val[perm[(perm[x & 255] + y) & 255]];
  // periodic value noise: period p (lattice cells) so textures tile
  function n2(x, y, p, q = p) {   // periods p (x) and q (y), in lattice cells, so textures tile
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % p) + p) % p, y0 = ((yi % q) + q) % q, x1 = (x0 + 1) % p, y1 = (y0 + 1) % q;
    const a = h(x0, y0), b = h(x1, y0), c = h(x0, y1), d = h(x1, y1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, p, oct = 5, gain = 0.5) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * n2(x * f, y * f, p * f); n += a; a *= gain; f *= 2; } return s / n; }
  // periodic cellular noise: returns [F1, F2, cell id 0..1]
  function cells(x, y, p, jitter = 0.9) {
    const xi = Math.floor(x), yi = Math.floor(y); let f1 = 9, f2 = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = xi + i, cy = yi + j, wx = ((cx % p) + p) % p, wy = ((cy % p) + p) % p;
      const hx = h(wx * 7 + 3, wy * 13 + 1), hy = h(wx * 11 + 5, wy * 3 + 7);
      const dx = cx + 0.5 + (hx - 0.5) * jitter - x, dy = cy + 0.5 + (hy - 0.5) * jitter - y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) { f2 = f1; f1 = d; id = h(wx * 5 + 11, wy * 17 + 2); } else if (d < f2) f2 = d;
    }
    return [f1, f2, id];
  }
  return { n2, fbm, cells, R };
}
const hex = c => { const n = parseInt(String(c).replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }; // display (sRGB) values
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const idle = () => new Promise(r => setTimeout(r, 0));

/* Each kind: (u, v, N, o) -> { c: [r,g,b] 0..1 display, h: height 0..1, r: roughness 0..1 } per texel */
const KINDS = {
  cork(N, o) {
    const C = (o.colors || ['#b67a45', '#8b5530', '#d9a168', '#5f3a1f']).map(hex), cellsN = o.scale || 90;
    return (u, v) => {
      const [f1, f2, id] = N.cells(u * cellsN, v * cellsN, cellsN, 1.0);
      const edge = clamp01((f2 - f1) * 3.2);
      const [g1, , id2] = N.cells(u * cellsN * 2.3 + 11, v * cellsN * 2.3 + 5, Math.round(cellsN * 2.3), 1.0);
      const tone = N.fbm(u * 6, v * 6, 6, 3);
      let c = mixc(C[0], id < 0.33 ? C[1] : id > 0.72 ? C[2] : C[0], 0.65 + id2 * 0.35);
      c = mixc(c, C[1], (1 - edge) * 0.55);
      const pore = N.fbm(u * 40, v * 40, 40, 3) < 0.28 + (1 - g1) * 0.02 ? 1 : 0;
      c = mixc(c, C[3], pore * 0.85);
      c = c.map(x => x * (0.86 + tone * 0.28));
      const h = 0.55 + 0.3 * edge * (0.6 + 0.4 * id) - pore * 0.45 - (1 - edge) * 0.12;
      return { c, h, r: 0.78 + pore * 0.15 - edge * 0.06 };
    };
  },
  wood(N, o) {   // planked hardwood: long streaky grain along u, dark latewood lines, pores, per-plank tone, seams
    // A finished (oiled) top: the grain lives in colour and in roughness (latewood and pores are duller, so
    // reflections break up along the grain); the height carries only the seams and a faint undulation. Grain in
    // the height reads as a hammered surface in close-ups on the high tier.
    const C = (o.colors || ['#7a5234', '#3e2716', '#a0714a']).map(hex), planks = o.planks || 5;
    return (u, v) => {
      const pv = v * planks, pi = Math.floor(pv), pf = pv - pi;
      const off = N.n2(pi * 3.7 + 0.5, 0.5, 64), tone = N.n2(pi * 5.3 + 0.5, 1.5, 64);
      const uu = (u + off * 5) % 1;
      const wave = Math.sin(uu * Math.PI * 2 * 2 + pi * 1.7) * 0.003 + (N.n2(uu * 3, pv * 2, 3, planks * 2) - 0.5) * 0.007;
      const vv = v + wave;
      const s1 = N.n2(uu * 2, vv * 70, 2, 70), s2 = N.n2(uu * 6, vv * 260, 6, 260), s3 = N.n2(uu * 24, vv * 700, 24, 700);
      const late = Math.pow(N.n2(uu * 3, vv * 110, 3, 110), 3) * 1.4;
      const pore = N.n2(uu * 140, vv * 1400, 140, 1400) > 0.88 ? 1 : 0;
      const seam = pf < 0.008 || pf > 0.992 ? 1 : 0;
      const joint = ((uu * 2 + tone) % 1) < 0.0025 ? 1 : 0;
      let c = mixc(C[2], C[0], clamp01(s1 * 0.9 + s2 * 0.35 + s3 * 0.15));
      c = mixc(c, C[1], clamp01(late * 0.5 + (seam || joint) * 0.9));
      c = c.map(x => x * (0.88 + tone * 0.24));
      // pores are a texel wide: in colour they turn into bold dashes in close-ups, so they only roughen the finish
      return { c, h: 0.55 + (s1 - 0.5) * 0.012 - (seam || joint) * 0.5, r: clamp01(0.5 + late * 0.12 + pore * 0.08 + (s3 - 0.5) * 0.08) };
    };
  },
  paper(N, o) {
    const C = (o.colors || ['#f1ece2', '#e2dac9']).map(hex);
    return (u, v) => {
      const f = N.fbm(u * 8, v * 8, 8, 5), fib = N.fbm(u * 90, v * 12, 90, 3);
      return { c: mixc(C[0], C[1], f * 0.8 + fib * 0.2), h: 0.5 + (f - 0.5) * 0.3 + (fib - 0.5) * 0.2, r: 0.9 };
    };
  },
  mat(N, o) { // cutting mat: base colour + noise; grid lines are drawn on the canvas afterwards (drawMat)
    const C = (o.colors || ['#2f5b43', '#274c38']).map(hex);
    return (u, v) => { const f = N.fbm(u * 10, v * 10, 10, 4); const s = N.fbm(u * 200, v * 200, 200, 2); return { c: mixc(C[0], C[1], f * 0.7 + s * 0.3), h: 0.5 + (s - 0.5) * 0.25, r: 0.72 + f * 0.1 }; };
  },
  concrete(N, o) {
    const C = (o.colors || ['#9a9690', '#7e7a74', '#b5b1aa']).map(hex);
    return (u, v) => {
      const f = N.fbm(u * 5, v * 5, 5, 6), sp = N.n2(u * 300, v * 300, 300), pore = N.fbm(u * 60, v * 60, 60, 3) < 0.25 ? 1 : 0;
      let c = mixc(C[0], f > 0.5 ? C[2] : C[1], Math.abs(f - 0.5) * 1.6);
      c = c.map(x => x * (0.94 + sp * 0.12) * (1 - pore * 0.35));
      return { c, h: 0.5 + (f - 0.5) * 0.5 - pore * 0.4 + (sp - 0.5) * 0.1, r: 0.88 - pore * 0.05 };
    };
  },
  brushed(N, o) {
    const C = (o.colors || ['#b9bcc0', '#8e9296']).map(hex);
    return (u, v) => { const s = N.fbm(u * 2, v * 260, 2, 4), f = N.fbm(u * 4, v * 4, 4, 3); return { c: mixc(C[0], C[1], s * 0.6 + f * 0.2), h: 0.5 + (s - 0.5) * 0.3, r: 0.32 + s * 0.2 }; };
  },
  fabric(N, o) {   // linen: fine warp/weft with slubs, low contrast
    const C = (o.colors || ['#e7e0d2', '#d4c9b6']).map(hex), k = o.scale || 240;
    return (u, v) => {
      const wu = 0.5 + 0.5 * Math.sin(u * k * Math.PI * 2 + (N.n2(u * 16, v * 3, 16, 3) - 0.5) * 3);
      const wv = 0.5 + 0.5 * Math.sin(v * k * Math.PI * 2 + (N.n2(u * 3, v * 16, 3, 16) - 0.5) * 3);
      const over = ((Math.floor(u * k) + Math.floor(v * k)) % 2) ? wu : wv;
      const slub = N.n2(u * k / 5, v * 7, k / 5, 7) * 0.5 + N.n2(u * 7, v * k / 5, 7, k / 5) * 0.5;
      const f = N.fbm(u * 5, v * 5, 5, 3);
      return { c: mixc(C[0], C[1], clamp01(over * 0.28 + slub * 0.32 + f * 0.3)), h: 0.4 + over * 0.3 + (slub - 0.5) * 0.2, r: 0.94 };
    };
  },
  terrazzo(N, o) {
    const C = (o.colors || ['#e9e4dc', '#c1553a', '#3a5a4d', '#d8b36a', '#2b2b2b']).map(hex), k = o.scale || 26;
    return (u, v) => {
      const [f1, f2, id] = N.cells(u * k, v * k, k, 0.95); const chip = f1 < 0.18 + id * 0.12 && id > 0.35 ? 1 : 0;
      const base = N.fbm(u * 40, v * 40, 40, 3);
      const c = chip ? C[1 + Math.floor(id * 4) % 4] : mixc(C[0], C[0].map(x => x * 0.9), base);
      return { c, h: 0.5, r: chip ? 0.28 : 0.4 };
    };
  },
  speckle(N, o) {
    const C = (o.colors || ['#ece6da', '#2b2724']).map(hex), k = o.scale || 140;
    return (u, v) => { const [f1, , id] = N.cells(u * k, v * k, k, 1); const dot = f1 < 0.12 && id > 0.7 ? 1 : 0; const f = N.fbm(u * 6, v * 6, 6, 3); return { c: dot ? C[1] : C[0].map(x => x * (0.95 + f * 0.08)), h: 0.5 + (f - 0.5) * 0.15, r: 0.3 + f * 0.15 }; };
  },
  grain(N, o) {
    const C = (o.colors || ['#808080']).map(hex);
    return (u, v) => { const f = N.fbm(u * 64, v * 64, 64, 3); return { c: C[0].map(x => x * (0.9 + f * 0.2)), h: f, r: 0.6 + f * 0.2 }; };
  }
};

/** Generate a texture set. o: { size, colors, seed, scale, repeat, normalStrength, anisotropy } */
export async function texture(kind, o = {}) {
  const S = o.size || 1024, N = makeNoise(o.seed || 7), fn = KINDS[kind](N, o);
  const rgba = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S), rough = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const t = fn(x / S, y / S), i = y * S + x;
      rgba[i * 4] = t.c[0] * 255; rgba[i * 4 + 1] = t.c[1] * 255; rgba[i * 4 + 2] = t.c[2] * 255; rgba[i * 4 + 3] = 255;
      height[i] = t.h; const r = clamp01(t.r) * 255; rough[i * 4] = r; rough[i * 4 + 1] = r; rough[i * 4 + 2] = r; rough[i * 4 + 3] = 255;
    }
    if (y % 48 === 47) { if (o.onProgress) o.onProgress(y / S); await idle(); }
  }
  if (o.onProgress) o.onProgress(1);
  const cMap = canvasFrom(rgba, S);
  if (kind === 'mat') drawMat(cMap, o);
  const map = new THREE.CanvasTexture(cMap); map.encoding = THREE.sRGBEncoding;
  const normal = new THREE.DataTexture(normalFromHeight(height, S, o.normalStrength ?? 2.5), S, S); normal.needsUpdate = true;
  const roughT = new THREE.DataTexture(rough, S, S); roughT.needsUpdate = true;
  for (const t of [map, normal, roughT]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = o.anisotropy || 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    if (o.repeat) t.repeat.set(o.repeat[0] ?? o.repeat, o.repeat[1] ?? o.repeat);
  }
  return { map, normal, rough: roughT, height, size: S, canvas: cMap };
}

function canvasFrom(rgba, S) { const c = document.createElement('canvas'); c.width = c.height = S; c.getContext('2d').putImageData(new ImageData(rgba, S, S), 0, 0); return c; }

/** Sobel normal map (OpenGL convention) from a height field */
export function normalFromHeight(h, S, strength = 2.5) {
  const out = new Uint8Array(S * S * 4), at = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * S + x) * 4; out[i] = (nx * 0.5 + 0.5) * 255; out[i + 1] = (ny * 0.5 + 0.5) * 255; out[i + 2] = (nz * 0.5 + 0.5) * 255; out[i + 3] = 255;
  }
  return out;
}

/* self-healing cutting mat: fine grid every cell, bold every 5, ruler numbers on two edges */
function drawMat(c, o) {
  const g = c.getContext('2d'), S = c.width, cells = o.cells || 20, step = S / cells, line = o.lineColor || 'rgba(236,240,226,0.55)';
  g.strokeStyle = line;
  for (let i = 0; i <= cells; i++) {
    const bold = i % 5 === 0; g.lineWidth = bold ? S / 520 : S / 1100; g.globalAlpha = bold ? 0.9 : 0.55;
    g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, S); g.stroke(); g.beginPath(); g.moveTo(0, i * step); g.lineTo(S, i * step); g.stroke();
    // half-cell ticks
    g.globalAlpha = 0.35; g.lineWidth = S / 1600; g.beginPath(); g.moveTo(i * step + step / 2, 0); g.lineTo(i * step + step / 2, S * 0.01); g.stroke();
  }
  if (o.numbers !== false) {
    g.globalAlpha = 0.75; g.fillStyle = line; g.font = `500 ${Math.round(step * 0.28)}px ${o.font || 'Helvetica, Arial, sans-serif'}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 1; i < cells; i++) { g.fillText(String(i * (o.unit || 10)), i * step, step * 0.35); g.save(); g.translate(step * 0.35, i * step); g.rotate(-Math.PI / 2); g.fillText(String(i * (o.unit || 10)), 0, 0); g.restore(); }
  }
  g.globalAlpha = 1;
}
