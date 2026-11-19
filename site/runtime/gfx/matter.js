/*
 * Matter: a GPU particle simulation. Positions and velocities live in float textures (ping-pong), the physics runs in
 * two full-screen passes, and every particle is drawn in one call. Real motion, not a vertex-shader wobble:
 *   springs pull each particle to its place in the current shape, a divergence-free (curl) flow moves it, the pointer
 *   pushes and swirls it, a burst throws it outward when the shape changes, and drag settles it.
 *
 *   const m = createMatter(app, { size: 256 (→ 65 536 particles), palette: ['#fff', '#9cf', '#f7c'] })
 *   m.setShape(points, { tint, burst, center, morph, instant })   points: Float32Array xyz (any length; cycled to fill)
 *     morph (s, default 1.1): the points leave the old form in a staggered sweep and stream along the current to the new
 *     one (instant: true jumps); halo (share of points, 0.07) and haloScale (m): a thinning cloud around the form;
 *     tint: per-point light
 *     (0 = shadow, in the third palette colour · 1 = lit · up to 1.6 = highlight; default 0.85)
 *   m.points (THREE.Points, add it to a scene) · m.uniforms (render) · m.sim (simulation uniforms)
 * Shapes: sampleMesh(P, I, n, opts) and sampleMeshLit(P, I, n, opts) (form from light + crease lines) from an EMB1 mesh
 *   (tools/sculpt.mjs), fitPoints(pts, size, center, rot), sampleText(text, opts), nebula(n, opts),
 *   and any Float32Array you make.
 * Params (animate them from scroll keys): matter.flow · matter.spring · matter.drag · matter.size · matter.opacity ·
 *   matter.focus (distance in focus) · matter.dof (blur per metre off focus) · matter.pointer (force) · matter.hot (brightness from speed)
 * Needs WebGL2 float render targets (EXT_color_buffer_float); falls back to a smaller count on the low tier.
 */
import * as THREE from 'three';

const QUAD_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// a cheap divergence-free flow: the curl of a potential made of rotated sine waves (analytic derivatives)
const CURL = `
vec3 curlFlow(vec3 p, float t){
  // potential A = (a1, a2, a3); curl A = (dA3/dy - dA2/dz, dA1/dz - dA3/dx, dA2/dx - dA1/dy)
  vec3 q = p;
  float a = 1.0, s = 1.0; vec3 c = vec3(0.0);
  for (int i = 0; i < 3; i++){
    vec3 k = q * s + vec3(t * 0.31, t * 0.23, t * 0.17) * s;
    // A1 = sin(k.y + cos(k.z)), A2 = sin(k.z + cos(k.x)), A3 = sin(k.x + cos(k.y))
    float dA1dy = cos(k.y + cos(k.z)) * s, dA1dz = cos(k.y + cos(k.z)) * -sin(k.z) * s;
    float dA2dz = cos(k.z + cos(k.x)) * s, dA2dx = cos(k.z + cos(k.x)) * -sin(k.x) * s;
    float dA3dx = cos(k.x + cos(k.y)) * s, dA3dy = cos(k.x + cos(k.y)) * -sin(k.y) * s;
    c += a * vec3(dA3dy - dA2dz, dA1dz - dA3dx, dA2dx - dA1dy);
    q = vec3(q.y * 0.8 + q.z * 0.6, q.z * 0.8 - q.x * 0.6, q.x);   // rotate the next octave
    a *= 0.5; s *= 2.1;
  }
  return c * 0.42;   // about unit length
}`;

// when each particle leaves its old form: part random, part a sweep across the old form (uMorphDir), over uMorphSpread s
const MORPH = `
float departAt(float seed, vec3 at){
  float sweep = clamp(dot(at, uMorphDir) / 5.0 + 0.5, 0.0, 1.0);
  return (0.45 * h1(seed * 3.91) + 0.55 * sweep) * uMorphSpread;
}`;

const VEL_FRAG = `
precision highp float;
uniform sampler2D tPos, tVel, tTarget, tPrev; uniform float uDt, uTime, uSpring, uDrag, uFlow, uFlowScale, uBurst, uPointerR, uPointerF, uWander, uMorph, uMorphSpread, uVortex;
uniform vec3 uRayO, uRayD, uPointerV, uBurstC, uMorphDir; varying vec2 vUv;
${CURL}
float h1(float n){ return fract(sin(n) * 43758.5453); }
${MORPH}
void main(){
  vec4 p = texture2D(tPos, vUv), v = texture2D(tVel, vUv), tg = texture2D(tTarget, vUv), tp = texture2D(tPrev, vUv);
  float seed = p.w, free = step(0.965, h1(seed * 91.7));                 // ~3.5 % are dust: loosely held, drifting
  float dep = departAt(seed, tp.xyz), go = step(dep, uMorph);              // each point leaves the old form at its own moment
  float travel = go * (1.0 - smoothstep(0.0, 0.9, uMorph - dep));         // just released: it streams along the current
  vec3 goal = mix(tp.xyz, tg.xyz, go);
  float k = uSpring * (0.55 + 0.9 * h1(seed * 7.13)) * mix(1.0, 0.04, free) * (1.0 - 0.55 * travel);
  vec3 acc = (goal - p.xyz) * k;
  acc += curlFlow(p.xyz * uFlowScale, uTime) * (uFlow * mix(1.0, 2.2, free) + travel * 0.7);
  acc += (cross(vec3(0.0, 1.0, 0.0), p.xyz) * uVortex + vec3(0.0, 0.35, 0.0)) * travel;   // in flight: a vortex carries it round
  acc += (vec3(h1(seed * 3.1), h1(seed * 5.3), h1(seed * 9.7)) - 0.5) * uWander;
  // the pointer: a force around the ray under the cursor (push out, swirl round, drag along)
  vec3 w = p.xyz - uRayO; float t = dot(w, uRayD); vec3 d = w - uRayD * t; float r2 = dot(d, d);
  float f = exp(-r2 / (uPointerR * uPointerR)) * uPointerF;
  acc += (normalize(d + 1e-5) * 2.4 + cross(uRayD, normalize(d + 1e-5)) * 1.6) * f + uPointerV * f * 1.2;
  vec3 vel = v.xyz * pow(uDrag, uDt * 60.0) + acc * uDt;
  vel += normalize(p.xyz - uBurstC + 1e-4) * uBurst * (0.35 + h1(seed * 3.7));
  gl_FragColor = vec4(vel, 1.0);
}`;
const POS_FRAG = `
precision highp float;
uniform sampler2D tPos, tVel; uniform float uDt; varying vec2 vUv;
void main(){ vec4 p = texture2D(tPos, vUv); vec3 v = texture2D(tVel, vUv).xyz; gl_FragColor = vec4(p.xyz + v * uDt, p.w); }`;

const DRAW_VERT = `
uniform sampler2D tPos, tVel, tTarget, tPrev; uniform float uSize, uPixel, uFocus, uDof, uOpacity, uHot, uMaxSize, uMorph, uMorphSpread; uniform vec3 uC0, uC1, uC2, uMorphDir;
attribute vec2 aRef; varying vec4 vColor; varying float vBlur;
float h1(float n){ return fract(sin(n) * 43758.5453); }
${MORPH}
void main(){
  vec4 p = texture2D(tPos, aRef); vec3 v = texture2D(tVel, aRef).xyz; vec4 tp = texture2D(tPrev, aRef);
  float tint = mix(tp.w, texture2D(tTarget, aRef).w, step(departAt(p.w, tp.xyz), uMorph));
  float seed = p.w, free = step(0.965, h1(seed * 91.7));
  vec4 mv = modelViewMatrix * vec4(p.xyz, 1.0);
  float depth = max(0.05, -mv.z);
  float blur = clamp(abs(depth - uFocus) * uDof, 0.0, 1.0);
  float big = pow(h1(seed * 13.7), 6.0);                                   // a few large points among many fine ones
  float s = uSize * (0.45 + big * 2.6) * mix(1.0, 0.6, free);
  gl_PointSize = min(uMaxSize, s * uPixel / depth * (1.0 + blur * 4.0));
  float speed = length(v);
  float light = clamp(tint, 0.0, 1.6);
  vec3 lit = mix(uC0, uC1, h1(seed * 5.3) * 0.85);
  lit = mix(lit, uC2 * 1.35 + 0.1, step(0.93, h1(seed * 17.1)) * 0.75);     // a few sparks in the accent colour
  vec3 col = mix(uC2 * 0.35, lit, min(1.0, light)) * (0.2 + 0.92 * light);  // form from light: shadows take the third colour
  col *= 1.0 + min(2.5, speed * uHot);
  float a = uOpacity * mix(1.0, 0.18, blur) * mix(1.0, 0.45, free) * (0.55 + 0.45 * h1(seed * 2.9));
  vColor = vec4(col, a); vBlur = blur;
  gl_Position = projectionMatrix * mv;
}`;
const DRAW_FRAG = `
varying vec4 vColor; varying float vBlur;
void main(){
  vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; if (r > 1.0) discard;
  float core = exp(-r * r * 7.0), disc = smoothstep(1.0, 0.72, r) * (0.55 + 0.45 * smoothstep(0.55, 0.95, r));   // bokeh: a ring-lit disc
  float a = mix(core, disc * 0.5, vBlur) * vColor.a;
  gl_FragColor = vec4(vColor.rgb * a, a);
}`;

export function createMatter(app, o = {}) {
  const P = app.params, gl = app.renderer, size = o.size || (app.quality === 'low' ? 128 : 256), N = size * size;
  P.defineAll({
    'matter.flow': [o.flow ?? 0.16, { rate: 1.5 }], 'matter.spring': [o.spring ?? 5, { rate: 1.5 }], 'matter.drag': [o.drag ?? 0.9, { rate: 2 }],
    'matter.size': [o.pointSize ?? 1.6, { rate: 2 }], 'matter.opacity': [o.opacity ?? 0.9, { rate: 2 }], 'matter.focus': [o.focus ?? 8, { rate: 1.6 }],
    'matter.dof': [o.dof ?? 0.12, { rate: 1.6 }], 'matter.pointer': [o.pointer ?? 1, { rate: 3 }], 'matter.hot': [o.hot ?? 0.25, { rate: 2 }],
    'matter.flowScale': [o.flowScale ?? 0.55, { rate: 1.2 }], 'matter.wander': [o.wander ?? 0.02, { rate: 2 }]
  });
  const rtOpts = { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false };
  const mk = () => new THREE.WebGLRenderTarget(size, size, rtOpts);
  let posA = mk(), posB = mk(), velA = mk(), velB = mk();
  const target = new THREE.DataTexture(new Float32Array(N * 4), size, size, THREE.RGBAFormat, THREE.FloatType); target.needsUpdate = true;
  const prev = new THREE.DataTexture(new Float32Array(N * 4), size, size, THREE.RGBAFormat, THREE.FloatType); prev.needsUpdate = true;

  const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; quadScene.add(quad);
  const S = {
    tPos: { value: null }, tVel: { value: null }, tTarget: { value: target }, uDt: { value: 0.016 }, uTime: { value: 0 },
    uSpring: { value: 2 }, uDrag: { value: 0.93 }, uFlow: { value: 0.5 }, uFlowScale: { value: 0.5 }, uBurst: { value: 0 }, uWander: { value: 0 },
    uPointerR: { value: o.pointerRadius ?? 0.9 }, uPointerF: { value: 0 }, uRayO: { value: new THREE.Vector3() }, uRayD: { value: new THREE.Vector3(0, 0, -1) },
    uPointerV: { value: new THREE.Vector3() }, uBurstC: { value: new THREE.Vector3() },
    tPrev: { value: prev }, uMorph: { value: 99 }, uMorphSpread: { value: 1.1 }, uMorphDir: { value: new THREE.Vector3(1, 0, 0) }, uVortex: { value: o.vortex ?? 2.6 }
  };
  const velMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: VEL_FRAG, uniforms: S, depthTest: false, depthWrite: false });
  const posMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: POS_FRAG, uniforms: S, depthTest: false, depthWrite: false });
  const copyMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: 'uniform sampler2D tMap; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tMap, vUv); }', uniforms: { tMap: { value: null } }, depthTest: false, depthWrite: false });
  const pass = (mat, rt) => { quad.material = mat; const prev = gl.getRenderTarget(); gl.setRenderTarget(rt); gl.render(quadScene, quadCam); gl.setRenderTarget(prev); };

  // initial state: a loose sphere of dust; each particle's seed in w
  const init = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.cbrt(Math.random()) * (o.startRadius ?? 6);
    const s = Math.sqrt(1 - u * u); init[i * 4] = Math.cos(th) * s * r; init[i * 4 + 1] = u * r; init[i * 4 + 2] = Math.sin(th) * s * r; init[i * 4 + 3] = Math.random() * 1000;
  }
  const initTex = new THREE.DataTexture(init, size, size, THREE.RGBAFormat, THREE.FloatType); initTex.needsUpdate = true;
  copyMat.uniforms.tMap.value = initTex; pass(copyMat, posA); pass(copyMat, posB);
  const zero = new THREE.DataTexture(new Float32Array(N * 4), size, size, THREE.RGBAFormat, THREE.FloatType); zero.needsUpdate = true;
  copyMat.uniforms.tMap.value = zero; pass(copyMat, velA); pass(copyMat, velB);
  target.image.data.set(init); target.needsUpdate = true; prev.image.data.set(init); prev.needsUpdate = true;

  // the drawn points: one vertex per particle, carrying its texel
  const g = new THREE.BufferGeometry(), ref = new Float32Array(N * 2), dummy = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { ref[i * 2] = (i % size + 0.5) / size; ref[i * 2 + 1] = (Math.floor(i / size) + 0.5) / size; }
  g.setAttribute('position', new THREE.BufferAttribute(dummy, 3)); g.setAttribute('aRef', new THREE.BufferAttribute(ref, 2));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const pal = (o.palette || ['#fff4e6', '#9fc4ff', '#ff9ad5']).map(c => new THREE.Color(c));
  const U = {
    tPos: { value: posA.texture }, tVel: { value: velA.texture }, tTarget: { value: target }, uSize: { value: 1.6 }, uPixel: { value: 1 }, uFocus: { value: 8 }, uDof: { value: 0.1 },
    uOpacity: { value: 0.9 }, uHot: { value: 0.25 }, uMaxSize: { value: o.maxSize ?? 48 }, uC0: { value: pal[0] }, uC1: { value: pal[1] }, uC2: { value: pal[2] || pal[1] },
    tPrev: S.tPrev, uMorph: S.uMorph, uMorphSpread: S.uMorphSpread, uMorphDir: S.uMorphDir
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: DRAW_VERT, fragmentShader: DRAW_FRAG, uniforms: U, transparent: true, depthWrite: false, blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  if (o.additive !== false) { mat.blending = THREE.AdditiveBlending; mat.premultipliedAlpha = true; }
  const points = new THREE.Points(g, mat); points.frustumCulled = false; points.renderOrder = o.renderOrder ?? 10;   // after glass: points in front stay, points behind are hidden by its depth (the glass refracts them)
  // sizes are in pixels of the target being drawn: the glass draws the world at half size, so points must shrink with it
  const dbs = new THREE.Vector2();
  points.onBeforeRender = (r, sc, cam) => { const rt = r.getRenderTarget(), h = rt ? rt.height : r.getDrawingBufferSize(dbs).y; U.uPixel.value = h * 0.5 / Math.tan(THREE.MathUtils.degToRad(cam.fov || 35) / 2) / 100; mat.uniformsNeedUpdate = true; };

  const api = { points, uniforms: U, sim: S, size, count: N, palette: pal, running: true, simTime: 0, stirK: 0 };
  /** a transient current (it decays over about a second): the matter swirls while it travels */
  api.stir = k => { api.stirK = Math.max(api.stirK, k); };
  /** fly to a new shape: points (xyz, any count, cycled), optional per-point tint (0..1 → palette[2]) */
  api.setShape = (pts, opt = {}) => {
    const d = target.image.data, m = pts.length / 3, tint = opt.tint, jit = opt.jitter || 0;
    const halo = opt.halo ?? o.halo ?? 0.07, haloR = opt.haloScale ?? o.haloScale ?? 0.38;
    const morph = !opt.instant && (opt.morph ?? o.morph ?? 1.1) > 0;
    if (morph) {
      prev.image.data.set(d); prev.needsUpdate = true;
      S.uMorph.value = 0; S.uMorphSpread.value = opt.morph ?? o.morph ?? 1.1;
      const a = Math.random() * Math.PI * 2; S.uMorphDir.value.set(Math.cos(a), Math.sin(a) * 0.5, Math.sin(a) * 0.35).normalize();
    }
    for (let i = 0; i < N; i++) {
      const j = (i * 2654435761 % m + m) % m;                        // spread the particles over the shape in a hashed order
      d[i * 4] = pts[j * 3] + (Math.random() - 0.5) * jit; d[i * 4 + 1] = pts[j * 3 + 1] + (Math.random() - 0.5) * jit; d[i * 4 + 2] = pts[j * 3 + 2] + (Math.random() - 0.5) * jit;
      d[i * 4 + 3] = tint ? tint[j] : (opt.light ?? 0.85);
      if (halo > 0 && ((i * 40503) % 1000) / 1000 < halo) {
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s2 = Math.sqrt(1 - u * u), r = -Math.log(1 - Math.random() * 0.98) * haloR;
        d[i * 4] += Math.cos(a) * s2 * r; d[i * 4 + 1] += u * r; d[i * 4 + 2] += Math.sin(a) * s2 * r;
        d[i * 4 + 3] *= 0.32 * Math.exp(-r / (haloR * 2));
      }
    }
    target.needsUpdate = true;
    if (!morph) { prev.image.data.set(d); prev.needsUpdate = true; S.uMorph.value = 99; }
    if (opt.burst) { S.uBurst.value = opt.burst; if (opt.center) S.uBurstC.value.copy(opt.center); api.stir(opt.stir ?? (morph ? 0 : opt.burst * 0.35)); }
  };
  /** the simulated positions, read back from the GPU (for checks and tools; it stalls the pipeline, never per frame) */
  api.readPositions = () => { const out = new Float32Array(N * 4); gl.readRenderTargetPixels(posA, 0, 0, size, size, out); return out; };
  /** where each particle is being pulled (xyz) and its light (w) */
  api.targets = () => target.image.data;
  /** median distance from each particle to its place in the shape (dust included; the median ignores it) */
  api.settledness = (n = 4096) => {
    const p = api.readPositions(), t = target.image.data, step = Math.max(1, Math.floor(N / n)), d = [];
    for (let i = 0; i < N; i += step) d.push(Math.hypot(p[i * 4] - t[i * 4], p[i * 4 + 1] - t[i * 4 + 1], p[i * 4 + 2] - t[i * 4 + 2]));
    d.sort((a, b) => a - b); return d[d.length >> 1];
  };
  /** colours of the three palette slots (the page grades toward the current project) */
  api.setPalette = (cols, k = 1) => { cols.forEach((c, i) => { if (pal[i]) pal[i].lerp(new THREE.Color(c), k); }); };

  function simStep(step) {
    S.uDt.value = step; api.simTime += step; S.uMorph.value = Math.min(99, S.uMorph.value + step);
    S.tPos.value = posA.texture; S.tVel.value = velA.texture; pass(velMat, velB);
    S.tVel.value = velB.texture; pass(posMat, posB);
    [posA, posB] = [posB, posA]; [velA, velB] = [velB, velA];
    S.uBurst.value = 0;                                                  // a burst is one kick
    U.tPos.value = posA.texture; U.tVel.value = velA.texture;
  }
  /** run the physics without drawing (captures, and slow devices after a shape change) */
  api.warm = (steps = 120, step = 1 / 60) => {
    api.stirK = 0;
    S.uSpring.value = P.get('matter.spring'); S.uDrag.value = P.get('matter.drag'); S.uFlow.value = P.get('matter.flow'); S.uFlowScale.value = P.get('matter.flowScale'); S.uWander.value = P.get('matter.wander');
    const f = S.uPointerF.value; S.uPointerF.value = 0;
    for (let i = 0; i < steps; i++) { S.uTime.value += step; simStep(step); }
    S.uPointerF.value = f;
  };
  if (app.onSettle) app.onSettle(() => api.warm(o.settleSteps ?? 180));

  // the pointer ray in the points' space
  const ndc = new THREE.Vector2(), ray = new THREE.Raycaster(), inv = new THREE.Matrix4(), prevHit = new THREE.Vector3(), hit = new THREE.Vector3();
  let havePrev = false;
  app.add((t, dt) => {
    // draw uniforms first: a paused simulation still draws at the right size
    U.uSize.value = P.get('matter.size'); U.uOpacity.value = P.get('matter.opacity'); U.uFocus.value = P.get('matter.focus'); U.uDof.value = P.get('matter.dof'); U.uHot.value = P.get('matter.hot');
    if (!api.running || !points.visible) return;
    // slow frames take two smaller steps (stable, and the matter keeps real time down to ~15 fps)
    const sub = dt > 1 / 30 ? 2 : 1, step = Math.min(dt / sub, 1 / 30);
    S.uTime.value = t;
    api.stirK *= Math.exp(-dt * 1.6);
    S.uSpring.value = P.get('matter.spring'); S.uDrag.value = P.get('matter.drag'); S.uFlow.value = (P.get('matter.flow') + api.stirK) * (app.reduced ? 0.25 : 1); S.uFlowScale.value = P.get('matter.flowScale');
    S.uWander.value = P.get('matter.wander') * (app.reduced ? 0.25 : 1);
    // pointer (fine pointers; touch pushes while pressed)
    const active = (app.input.fine && app.input.moved) || app.input.down;
    ndc.set(app.input.nx, app.input.ny); ray.setFromCamera(ndc, app.camera);
    points.updateMatrixWorld(); inv.copy(points.matrixWorld).invert();
    S.uRayO.value.copy(ray.ray.origin).applyMatrix4(inv); S.uRayD.value.copy(ray.ray.direction).transformDirection(inv);
    hit.copy(S.uRayO.value).addScaledVector(S.uRayD.value, Math.max(1, P.get('matter.focus')));
    if (havePrev) S.uPointerV.value.copy(hit).sub(prevHit).divideScalar(Math.max(step, 1e-3)).clampLength(0, 6); else S.uPointerV.value.set(0, 0, 0);
    prevHit.copy(hit); havePrev = true;
    S.uPointerF.value = active && !app.reduced ? P.get('matter.pointer') : 0;
    for (let i = 0; i < sub; i++) { S.uTime.value = t - (sub - 1 - i) * step; simStep(step); }
  }, -5);
  return api;
}

/* ---------------- shapes ---------------- */

/** n points on the surface of an EMB1 mesh (area-weighted), pushed a little inside so the shell has thickness */
export function sampleMesh(P, I, n, o = {}) {
  const nf = I.length / 3, cum = new Float64Array(nf); let tot = 0;
  for (let f = 0; f < nf; f++) {
    const a = I[f * 3] * 3, b = I[f * 3 + 1] * 3, c = I[f * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    tot += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2; cum[f] = tot;
  }
  const out = new Float32Array(n * 3), depth = o.depth ?? 0.03, sc = o.scale ?? 1, off = o.offset || [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const r = Math.random() * tot; let lo = 0, hi = nf - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
    const f = lo, a = I[f * 3] * 3, b = I[f * 3 + 1] * 3, c = I[f * 3 + 2] * 3;
    let u = Math.random(), v = Math.random(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const dIn = -Math.pow(Math.random(), 2.5) * depth;
    out[i * 3] = (P[a] + ux * u + vx * v + nx * dIn) * sc + off[0];
    out[i * 3 + 1] = (P[a + 1] + uy * u + vy * v + ny * dIn) * sc + off[1];
    out[i * 3 + 2] = (P[a + 2] + uz * u + vz * v + nz * dIn) * sc + off[2];
  }
  return out;
}

/**
 * n points on an EMB1 mesh, lit, for shapes that must read as forms: surface points carry a baked key light and a rim,
 * and a share of the points traces the sharp creases as bright lines (a light drawing of the object).
 *   { rot: [x, y, z] radians, size: longest side, center: [x, y, z], light: [x, y, z] direction (after rotation),
 *     edges: share of points on creases (0.16), crease: angle in degrees (32), depth: shell thickness (0.03) }
 * Returns { points, tint } for setShape.
 */
export function sampleMeshLit(P, I, n, o = {}) {
  const nf = I.length / 3, nv = P.length / 3, R = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...(o.rot || [0, 0, 0]))), e = R.elements;
  const V = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; V[i * 3] = e[0] * x + e[4] * y + e[8] * z; V[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z; V[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z; }
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nv * 3; i++) { const c = i % 3; if (V[i] < lo[c]) lo[c] = V[i]; if (V[i] > hi[c]) hi[c] = V[i]; }
  const sc = (o.size ?? 3) / Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]), C = o.center || [0, 0, 0];
  for (let i = 0; i < nv * 3; i++) { const c = i % 3; V[i] = (V[i] - (lo[c] + hi[c]) / 2) * sc + C[c]; }
  const fn = new Float32Array(nf * 3), cum = new Float64Array(nf); let tot = 0;
  for (let f = 0; f < nf; f++) {
    const a = I[f * 3] * 3, b = I[f * 3 + 1] * 3, c = I[f * 3 + 2] * 3;
    const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2], vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
    fn[f * 3] = nx / l; fn[f * 3 + 1] = ny / l; fn[f * 3 + 2] = nz / l; tot += l / 2; cum[f] = tot;
  }
  // creases: edges whose two faces meet at more than `crease` degrees
  const faces = new Map(), key = (a, b) => a < b ? a * 4194304 + b : b * 4194304 + a;
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) { const a = I[f * 3 + k], b = I[f * 3 + (k + 1) % 3], id = key(a, b), l = faces.get(id); if (l) l.push(f); else faces.set(id, [a, b, f]); }
  const cosT = Math.cos((o.crease ?? 32) * Math.PI / 180), edges = []; let elen = 0;
  for (const l of faces.values()) {
    if (l.length !== 4) continue; const f = l[2] * 3, g = l[3] * 3;
    if (fn[f] * fn[g] + fn[f + 1] * fn[g + 1] + fn[f + 2] * fn[g + 2] > cosT) continue;
    const a = l[0] * 3, b = l[1] * 3; elen += Math.hypot(V[b] - V[a], V[b + 1] - V[a + 1], V[b + 2] - V[a + 2]); edges.push(a, b, elen);
  }
  const nEdge = edges.length ? Math.round(n * (o.edges ?? 0.16)) : 0, nSurf = n - nEdge, depth = o.depth ?? 0.03;
  const out = new Float32Array(n * 3), tint = new Float32Array(n);
  const L = o.light || [-0.45, 0.75, 0.55], ll = Math.hypot(L[0], L[1], L[2]), lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
  for (let i = 0; i < nSurf; i++) {
    const r = Math.random() * tot; let a0 = 0, a1 = nf - 1; while (a0 < a1) { const m = (a0 + a1) >> 1; if (cum[m] < r) a0 = m + 1; else a1 = m; }
    const f = a0, a = I[f * 3] * 3, b = I[f * 3 + 1] * 3, c = I[f * 3 + 2] * 3, nx = fn[f * 3], ny = fn[f * 3 + 1], nz = fn[f * 3 + 2];
    let u = Math.random(), v = Math.random(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const dIn = -Math.pow(Math.random(), 2.5) * depth;
    for (let k = 0; k < 3; k++) out[i * 3 + k] = V[a + k] + (V[b + k] - V[a + k]) * u + (V[c + k] - V[a + k]) * v + fn[f * 3 + k] * dIn;
    const ndl = nx * lx + ny * ly + nz * lz, rim = Math.pow(1 - Math.abs(nz), 3) * 0.4;
    tint[i] = 0.12 + 0.88 * Math.max(0, ndl) + rim - (dIn < -depth * 0.3 ? 0.08 : 0);
  }
  for (let i = 0; i < nEdge; i++) {
    const r = Math.random() * elen; let a0 = 0, a1 = edges.length / 3 - 1; while (a0 < a1) { const m = (a0 + a1) >> 1; if (edges[m * 3 + 2] < r) a0 = m + 1; else a1 = m; }
    const a = edges[a0 * 3], b = edges[a0 * 3 + 1], t = Math.random(), k = nSurf + i;
    for (let q = 0; q < 3; q++) out[k * 3 + q] = V[a + q] + (V[b + q] - V[a + q]) * t;
    tint[k] = 1.3;
  }
  return { points: out, tint };
}

/** rotate (Euler radians) then fit points into a box whose longest side is `size`, centred on `center` (in place) */
export function fitPoints(pts, size = 3, center = [0, 0, 0], rot = [0, 0, 0]) {
  const R = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])), e = R.elements;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i], y = pts[i + 1], z = pts[i + 2];
    pts[i] = e[0] * x + e[4] * y + e[8] * z; pts[i + 1] = e[1] * x + e[5] * y + e[9] * z; pts[i + 2] = e[2] * x + e[6] * y + e[10] * z;
    for (let c = 0; c < 3; c++) { if (pts[i + c] < lo[c]) lo[c] = pts[i + c]; if (pts[i + c] > hi[c]) hi[c] = pts[i + c]; }
  }
  const sc = size / Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  for (let i = 0; i < pts.length; i += 3) for (let c = 0; c < 3; c++) pts[i + c] = (pts[i + c] - (lo[c] + hi[c]) / 2) * sc + center[c];
  return pts;
}

/** n points filling the letters of a text (drawn on a canvas), centred, `height` world units tall, with a little depth */
export function sampleText(text, o = {}) {
  const n = o.count || 20000, font = o.font || '800 220px sans-serif', pad = 20;
  const c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = font; const w = Math.ceil(x.measureText(text).width) + pad * 2, hPx = Math.ceil(parseFloat(/(\d+)px/.exec(font)[1]) * 1.25) + pad * 2;
  c.width = w; c.height = hPx; x.font = font; x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.textAlign = 'center';
  if (o.letterSpacing) try { x.letterSpacing = o.letterSpacing; } catch (e) { /* older canvases */ }
  x.fillText(text, w / 2, hPx / 2);
  const img = x.getImageData(0, 0, w, hPx).data, cand = [];
  for (let y = 0; y < hPx; y += 1) for (let xx = 0; xx < w; xx += 1) if (img[(y * w + xx) * 4 + 3] > 128) cand.push(xx, y);
  const H = o.height || 1.4, sc = H / hPx, out = new Float32Array(n * 3), m = cand.length / 2, dz = o.depth ?? 0.12;
  for (let i = 0; i < n; i++) {
    const j = Math.floor(Math.random() * m);
    out[i * 3] = (cand[j * 2] + Math.random() - w / 2) * sc; out[i * 3 + 1] = -(cand[j * 2 + 1] + Math.random() - hPx / 2) * sc; out[i * 3 + 2] = (Math.random() - 0.5) * dz;
  }
  return out;
}

/** a nebula: a soft spiral cloud with a dense core (for intros and interludes) */
export function nebula(n, o = {}) {
  const out = new Float32Array(n * 3), R = o.radius || 5, arms = o.arms || 3, twist = o.twist ?? 2.4, thick = o.thickness ?? 0.35;
  for (let i = 0; i < n; i++) {
    const r = Math.pow(Math.random(), 1.8) * R, arm = Math.floor(Math.random() * arms), a = arm / arms * Math.PI * 2 + r / R * twist * Math.PI + (Math.random() - 0.5) * (0.6 + r / R * 0.4);
    const y = (Math.random() - 0.5) * thick * (1.2 - r / R) + (Math.random() - 0.5) * 0.05;
    out[i * 3] = Math.cos(a) * r; out[i * 3 + 1] = y; out[i * 3 + 2] = Math.sin(a) * r;
  }
  return out;
}

/** read an EMB1 emblem (tools/sculpt.mjs) as raw arrays */
export async function loadEMB(url) {
  const buf = await (await fetch(url)).arrayBuffer(), dv = new DataView(buf);
  const hl = dv.getUint32(4, true), header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)).trim().replace(/\0+$/, ''));
  let off = 8 + hl;
  const P = new Float32Array(buf.slice(off, off + header.vertices * 12)); off += header.vertices * 12;
  const I = header.index === 32 ? new Uint32Array(buf.slice(off, off + header.faces * 12)) : new Uint16Array(buf.slice(off, off + header.faces * 6));
  return { header, P, I };
}
