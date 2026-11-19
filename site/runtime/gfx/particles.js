/*
 * Particles that carry meaning.
 *
 * morphPoints: up to 4 point-cloud shapes held by the same particles; param `<id>.morph` (0..3, fractional
 * blends) moves them from one shape to the next through curl-like noise. Shapes come from anything:
 *   sampleText('ZERO', { font: '800 300px Inter' }), sampleMesh(mesh), sampleImage(img), shapes.sphere(n) …
 *   const p = morphPoints(app, { id: 'dust', count: 12000, shapes: [a, b, c], size: 2.2, color: '#ffe8c4' });
 *   choreo: { 'dust.morph': 1, 'dust.spread': 0.2, 'dust.opacity': 0.9 }
 *
 * drift: falling / floating things (petals, leaves, snow, embers, dust motes) as instanced quads with tumble,
 * wind and depth fade: drift(app, { kind: 'petals', count: 400, area: [20, 12, 20], color: '#f3c7cf' }).
 */
import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

const NOISE = `
vec3 hash3(vec3 p){ p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453) * 2.0 - 1.0; }
float n3(vec3 p){ vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dot(hash3(i), f), dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x), mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
             mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x), mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z); }
vec3 flow(vec3 p){ return vec3(n3(p + 11.3), n3(p + 47.1), n3(p + 83.9)); }`;

export function morphPoints(app, o = {}) {
  const id = o.id || 'points', n = o.count || 8000, shapes = o.shapes || [shapes_.sphere(n)];
  const g = new THREE.BufferGeometry();
  const fit = s => { const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const j = (i % (s.length / 3)) * 3; a[i * 3] = s[j]; a[i * 3 + 1] = s[j + 1]; a[i * 3 + 2] = s[j + 2]; } return a; };
  for (let k = 0; k < 4; k++) g.setAttribute('p' + k, new THREE.BufferAttribute(fit(shapes[Math.min(k, shapes.length - 1)]), 3));
  g.setAttribute('position', g.getAttribute('p0'));
  const seed = new Float32Array(n); for (let i = 0; i < n; i++) seed[i] = Math.random(); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const P = app.params;
  P.define(id + '.morph', 0, { min: 0, max: shapes.length - 1, rate: 1.6 });
  P.define(id + '.spread', o.spread ?? 0.15, { min: 0, max: 2 });
  P.define(id + '.opacity', o.opacity ?? 1, { min: 0, max: 1 });
  P.define(id + '.size', o.size ?? 2, { min: 0.2, max: 12 });
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: o.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
    uniforms: { uMorph: { value: 0 }, uSpread: { value: 0 }, uTime: { value: 0 }, uSize: { value: 2 }, uOpacity: { value: 1 }, uPx: { value: 1 },
      uColor: { value: new THREE.Color(o.color || '#ffffff') }, uColor2: { value: new THREE.Color(o.color2 || o.color || '#ffffff') }, uPointer: { value: new THREE.Vector3(999, 999, 0) }, uPush: { value: o.push ?? 0.6 } },
    vertexShader: NOISE + `
      attribute vec3 p0, p1, p2, p3; attribute float seed;
      uniform float uMorph, uSpread, uTime, uSize, uPx, uPush; uniform vec3 uPointer; varying float vA; varying float vS;
      void main(){
        float m = clamp(uMorph, 0.0, 3.0); vec3 a = m < 1.0 ? p0 : m < 2.0 ? p1 : p2; vec3 b = m < 1.0 ? p1 : m < 2.0 ? p2 : p3;
        float f = fract(m); if (m >= 3.0) { a = p3; b = p3; f = 0.0; }
        float lag = clamp(f * 1.6 - seed * 0.6, 0.0, 1.0); lag = lag * lag * (3.0 - 2.0 * lag);
        vec3 p = mix(a, b, lag);
        float mid = sin(3.14159 * lag);
        p += flow(p * 0.55 + uTime * 0.12 + seed) * (uSpread + mid * 0.9);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec3 wp = (modelMatrix * vec4(p, 1.0)).xyz; float dp = distance(wp.xy, uPointer.xy);
        mv.xy += normalize(wp.xy - uPointer.xy + 1e-4) * uPush * exp(-dp * dp * 2.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPx * (0.6 + seed * 0.8) * (6.0 / -mv.z);
        vA = 0.55 + 0.45 * sin(uTime * (0.6 + seed * 1.6) + seed * 40.0); vS = seed;
      }`,
    fragmentShader: `uniform float uOpacity; uniform vec3 uColor, uColor2; varying float vA; varying float vS;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d); a *= a; if (a < 0.01) discard;
        gl_FragColor = vec4(mix(uColor, uColor2, vS), a * uOpacity * vA); }`
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  (o.parent || app.scene).add(pts);
  const ray = new THREE.Raycaster(), pl = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
  app.add(t => {
    const U = mat.uniforms; U.uTime.value = t; U.uMorph.value = P.get(id + '.morph'); U.uSpread.value = P.get(id + '.spread');
    U.uOpacity.value = P.get(id + '.opacity'); U.uSize.value = P.get(id + '.size'); U.uPx.value = app.dpr * app.height / 900;
    if (o.push !== 0 && app.camera) { ray.setFromCamera({ x: app.input.nx, y: app.input.ny }, app.camera); if (ray.ray.intersectPlane(pl, hit)) U.uPointer.value.copy(hit); }
  });
  return { points: pts, material: mat, id };
}

/* ---------- shape samplers: all return Float32Array xyz, centred ---------- */
export function sampleText(text, o = {}) {
  const n = o.count || 8000, W = o.width || 1400, H = o.height || 420;
  // willReadFrequently keeps the canvas on the CPU: reading back a GPU canvas waits for all queued GPU work (seconds
  // while shaders compile during the load)
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.font = o.font || '800 300px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (o.tracking) g.letterSpacing = o.tracking;
  g.fillText(text, W / 2, H / 2);
  return fromCanvas(c, n, o.scale || 8, o.depth ?? 0.25);
}
export function sampleImage(img, o = {}) {
  const W = o.width || 400, H = Math.round(W * img.height / img.width);
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, W, H);
  return fromCanvas(c, o.count || 8000, o.scale || 8, o.depth ?? 0.25, true);
}
function fromCanvas(c, n, scale, depth, luminance) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, pts = [];
  for (let y = 0; y < c.height; y += 1) for (let x = 0; x < c.width; x += 1) { const i = (y * c.width + x) * 4; const v = luminance ? (d[i] + d[i + 1] + d[i + 2]) / 765 : d[i + 3] / 255; if (v > 0.5 && Math.random() < v) pts.push(x, y); }
  const out = new Float32Array(n * 3), s = scale / c.width;
  for (let i = 0; i < n; i++) { const k = ((Math.random() * pts.length / 2) | 0) * 2; out[i * 3] = (pts[k] - c.width / 2) * s + (Math.random() - 0.5) * s; out[i * 3 + 1] = -(pts[k + 1] - c.height / 2) * s + (Math.random() - 0.5) * s; out[i * 3 + 2] = (Math.random() - 0.5) * depth; }
  return out;
}
export function sampleMesh(mesh, n = 8000) {
  const s = new MeshSurfaceSampler(mesh).build(), p = new THREE.Vector3(), out = new Float32Array(n * 3);
  mesh.updateMatrixWorld(true);
  for (let i = 0; i < n; i++) { s.sample(p); p.applyMatrix4(mesh.matrixWorld); out[i * 3] = p.x; out[i * 3 + 1] = p.y; out[i * 3 + 2] = p.z; }
  return out;
}
const shapes_ = {
  sphere(n, r = 2.4) { const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), rr = r * Math.cbrt(0.85 + Math.random() * 0.15); a[i * 3] = s * Math.cos(t) * rr; a[i * 3 + 1] = u * rr; a[i * 3 + 2] = s * Math.sin(t) * rr; } return a; },
  ring(n, r = 2.4, w = 0.25) { const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const t = Math.random() * Math.PI * 2, rr = r + (Math.random() - 0.5) * w; a[i * 3] = Math.cos(t) * rr; a[i * 3 + 1] = Math.sin(t) * rr; a[i * 3 + 2] = (Math.random() - 0.5) * w; } return a; },
  cloud(n, s = [10, 6, 6]) { const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = (Math.random() - 0.5) * s[0]; a[i * 3 + 1] = (Math.random() - 0.5) * s[1]; a[i * 3 + 2] = (Math.random() - 0.5) * s[2]; } return a; },
  plane(n, s = [8, 5]) { const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = (Math.random() - 0.5) * s[0]; a[i * 3 + 1] = (Math.random() - 0.5) * s[1]; a[i * 3 + 2] = 0; } return a; },
  spiral(n, turns = 3, r = 2.6) { const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const t = Math.random(), ang = t * turns * Math.PI * 2, rr = r * t + Math.random() * 0.15; a[i * 3] = Math.cos(ang) * rr; a[i * 3 + 1] = (t - 0.5) * 3; a[i * 3 + 2] = Math.sin(ang) * rr; } return a; }
};
export const shapes = shapes_;

/* ---------- drifting things ---------- */
export function drift(app, o = {}) {
  const kind = o.kind || 'dust', n = o.count || (kind === 'dust' ? 600 : 300), A = o.area || [20, 12, 16];
  const geo = kind === 'dust' || kind === 'embers' || kind === 'snow' ? new THREE.PlaneGeometry(1, 1) : petalGeometry();
  const ig = new THREE.InstancedBufferGeometry(); ig.index = geo.index; ig.setAttribute('position', geo.getAttribute('position')); ig.setAttribute('uv', geo.getAttribute('uv'));
  const off = new Float32Array(n * 4); for (let i = 0; i < n; i++) { off[i * 4] = (Math.random() - 0.5) * A[0]; off[i * 4 + 1] = (Math.random() - 0.5) * A[1]; off[i * 4 + 2] = (Math.random() - 0.5) * A[2]; off[i * 4 + 3] = Math.random(); }
  ig.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4)); ig.instanceCount = n;
  const P = app.params, id = o.id || kind;
  P.define(id + '.amount', o.amount ?? 1, { min: 0, max: 1 }); P.define(id + '.wind', o.wind ?? 0.4, { min: -3, max: 3 }); P.define(id + '.opacity', o.opacity ?? 0.8, { min: 0, max: 1 });
  const fall = { petals: 0.35, leaves: 0.5, snow: 0.25, dust: -0.02, embers: -0.45 }[kind] ?? 0.2;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: kind === 'embers' || kind === 'dust' ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uTime: { value: 0 }, uArea: { value: new THREE.Vector3().fromArray(A) }, uWind: { value: 0 }, uFall: { value: fall * (o.fall ?? 1) }, uSize: { value: o.size ?? (kind === 'dust' ? 0.035 : kind === 'embers' ? 0.05 : 0.14) }, uAmount: { value: 1 }, uOpacity: { value: 1 },
      uColor: { value: new THREE.Color(o.color || { petals: '#f2c4cc', leaves: '#b6893f', snow: '#ffffff', dust: '#ffe9c8', embers: '#ff9a3c' }[kind] || '#ffffff') }, uColor2: { value: new THREE.Color(o.color2 || o.color || '#ffffff') }, uRound: { value: kind === 'dust' || kind === 'snow' || kind === 'embers' ? 1 : 0 } },
    vertexShader: NOISE + `attribute vec4 aOff; uniform float uTime, uWind, uFall, uSize, uAmount; uniform vec3 uArea; varying vec2 vUv; varying float vSeed; varying float vVis; varying vec3 vN;
      mat3 rot(vec3 a){ float cx = cos(a.x), sx = sin(a.x), cy = cos(a.y), sy = sin(a.y), cz = cos(a.z), sz = sin(a.z); return mat3(cy*cz, cy*sz, -sy, sx*sy*cz - cx*sz, sx*sy*sz + cx*cz, sx*cy, cx*sy*cz + sx*sz, cx*sy*sz - sx*cz, cx*cy); }
      void main(){ float s = aOff.w; vSeed = s; vUv = uv; vVis = step(s, uAmount);
        vec3 p = aOff.xyz; float t = uTime * (0.6 + s * 0.8);
        p.y -= uFall * t; p.x += uWind * t + sin(t * 0.7 + s * 30.0) * 0.4; p.z += cos(t * 0.5 + s * 20.0) * 0.3;
        p += flow(p * 0.2 + uTime * 0.05) * 0.6;
        p = mod(p + uArea * 0.5, uArea) - uArea * 0.5;
        vec3 v = position * uSize * (0.6 + s * 0.8);
        mat3 R = rot(vec3(t * 1.3 + s * 6.0, t * 0.9 + s * 3.0, t * 0.7));
        vec4 mv;
        if (uSize < 0.08) { mv = modelViewMatrix * vec4(p, 1.0); mv.xy += v.xy; vN = vec3(0.0, 0.0, 1.0); }
        else { mv = modelViewMatrix * vec4(p + R * v, 1.0); vN = normalize(normalMatrix * (R * vec3(0.0, 0.0, 1.0))); }
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor, uColor2; uniform float uOpacity, uRound; varying vec2 vUv; varying float vSeed; varying float vVis; varying vec3 vN;
      void main(){ if (vVis < 0.5) discard; float a = 1.0; if (uRound > 0.5) { a = smoothstep(0.5, 0.0, length(vUv - 0.5)); } else { a = smoothstep(0.02, 0.12, vUv.x * (1.0 - vUv.x) * 4.0 * (1.0 - vUv.y)); }
        float light = 0.65 + 0.35 * abs(vN.z); vec3 c = mix(uColor, uColor2, vSeed) * light; gl_FragColor = vec4(c, a * uOpacity); }`
  });
  const mesh = new THREE.Mesh(ig, mat); mesh.frustumCulled = false; (o.parent || app.scene).add(mesh);
  app.add(t => { const U = mat.uniforms; U.uTime.value = t; U.uWind.value = P.get(id + '.wind'); U.uAmount.value = P.get(id + '.amount'); U.uOpacity.value = P.get(id + '.opacity'); });
  return { mesh, material: mat };
}
function petalGeometry() {
  const g = new THREE.PlaneGeometry(1, 1.3, 4, 4), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, (x * x) * 0.6 - y * 0.15); p.setX(i, x * (1 - Math.pow(Math.abs(y / 0.65), 3) * 0.6)); }
  g.computeVertexNormals(); return g;
}
