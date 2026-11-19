/*
 * Glass: thick rounded slabs that refract the world behind them with dispersion, catch a fresnel rim with a thin-film
 * (iridescent) edge, and carry media inside: a sequence of frames shown through a liquid flow distortion, changing by
 * a liquid dissolve.
 *
 *   const glass = createGlass(app, { layer: 3 })
 *   const panel = glass.panel({ width: 3.2, height: 2, depth: 0.12, radius: 0.12, frames: ['a.webp', 'b.webp'] })
 *   scene.add(panel.mesh) · panel.show(k 0..1) · panel.setFrames(urls) · panel.swap(urls) (melt into another sequence)
 *   · panel.setTitle(text) and swap(urls, { title }) when the panel has titles: true (the name drawn huge over the
 *   footage, melting with the frames) · panel.uniforms · glass.preload(urls)
 * How: each frame the scene is drawn once without the glass (the glass sits on its own camera layer) into a half-size
 * target; every panel samples that target at its screen position, offset along its normal, three times (R, G, B, each
 * a little further: dispersion). Params: glass.refract · glass.dispersion · glass.liquid · glass.rim
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const NOISE = `
float gh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float gn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }
float gfbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * gn(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }`;

const VERT = `
varying vec3 vN, vV, vObjN; varying vec2 vUv; varying vec4 vClip;
void main(){
  vUv = uv; vObjN = normal;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  vClip = projectionMatrix * mv; gl_Position = vClip;
}`;
const FRAG = `
uniform sampler2D tBehind, tA, tB; uniform float uMix, uTime, uRefract, uDisp, uLiquid, uRim, uShow, uHaveMedia, uMediaK, uMediaGain, uAspect, uHover;
uniform vec3 uTint, uRimColor; uniform vec2 uHoverUv; uniform vec3 uKenA, uKenB;
uniform sampler2D tTA, tTB; uniform float uHaveTitle; uniform vec3 uTitleColor;
varying vec3 vN, vV, vObjN; varying vec2 vUv; varying vec4 vClip;
${NOISE}
vec3 film(float x){ return 0.5 + 0.5 * cos(6.2832 * (x + vec3(0.0, 0.33, 0.67))); }
void main(){
  vec3 n = normalize(vN), v = normalize(vV);
  float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0);
  vec2 suv = vClip.xy / vClip.w * 0.5 + 0.5;
  float front = step(0.5, vObjN.z);
  // the liquid: a slow flow over the face, stronger where the pointer is
  vec2 q = vUv * vec2(uAspect, 1.0) * 2.2;
  float hov = uHover * exp(-dot((vUv - uHoverUv) * vec2(uAspect, 1.0), (vUv - uHoverUv) * vec2(uAspect, 1.0)) * 7.0);
  vec2 flow = vec2(gfbm(q + vec2(uTime * 0.07, uTime * 0.05)), gfbm(q + vec2(-uTime * 0.05, uTime * 0.08) + 7.3)) - 0.5;
  vec2 liquid = flow * (uLiquid + hov * 0.6);
  // refraction of the world behind, split in three (dispersion); edges bend more
  vec2 off = (n.xy * (0.4 + fres * 1.6) + liquid * 0.5) * uRefract;
  vec3 behind = vec3(texture2D(tBehind, suv + off * (1.0 - uDisp)).r, texture2D(tBehind, suv + off).g, texture2D(tBehind, suv + off * (1.0 + uDisp)).b);
  // the media inside (front face only), through the same liquid; frames change by a dissolve along the flow
  // each frame is held like footage: a slow push-in and drift (uKen: xy drift, z scale)
  vec2 muv = vUv + liquid * 0.35;
  vec2 ua = (muv - 0.5) * uKenA.z + 0.5 + uKenA.xy, ub = (muv - 0.5) * uKenB.z + 0.5 + uKenB.xy;
  vec3 ma = texture2D(tA, ua).rgb, mb = texture2D(tB, ub).rgb;
  float th = smoothstep(uMix - 0.12, uMix + 0.12, gfbm(q * 1.3 + 3.0) * 0.8 + vUv.x * 0.2 + 0.05);
  vec3 media = mix(mb, ma, th);
  // a faint chromatic split in the media itself
  vec2 sp = liquid * 0.08 + vec2(0.002, 0.0);
  media.r = mix(media.r, mix(texture2D(tB, ub + sp).r, texture2D(tA, ua + sp).r, th), 0.5);
  // the title: drawn huge over the footage, rippling with the liquid; it melts with the frames
  float tt = mix(texture2D(tTB, muv).a, texture2D(tTA, muv).a, th) * uHaveTitle;
  media *= 1.0 - 0.42 * uHaveTitle * smoothstep(0.62, 0.0, vUv.y);        // a shade under the title so it reads on bright footage
  media = mix(media, uTitleColor, tt * 0.94);
  float mk = uHaveMedia * front * uMediaK;
  vec3 col = mix(behind * uTint, media * uMediaGain, mk);
  col += film(fres * 1.4 + uTime * 0.02) * fres * uRim * uRimColor;       // thin-film rim
  float side = 1.0 - step(0.5, abs(vObjN.z));                               // the slab's edges and bevels catch light: its thickness reads
  col += side * (0.05 + 0.3 * fres) * uRim * mix(vec3(1.0), film(vUv.y * 2.0 + uTime * 0.03), 0.5);
  col += pow(max(0.0, dot(reflect(-v, n), normalize(vec3(-0.4, 0.8, 0.5)))), 40.0) * 0.6 * uRim;   // a soft specular glint
  float a = uShow;
  gl_FragColor = vec4(col * a, a);
}`;

export function createGlass(app, o = {}) {
  const P = app.params, layer = o.layer ?? 3, scale = o.scale ?? 0.5;
  P.defineAll({ 'glass.refract': [o.refract ?? 0.05, { rate: 2 }], 'glass.dispersion': [o.dispersion ?? 0.28, { rate: 2 }], 'glass.liquid': [o.liquid ?? 0.09, { rate: 2 }], 'glass.rim': [o.rim ?? 0.9, { rate: 2 }] });
  const behindRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
  const panels = [], loader = new THREE.TextureLoader(), cache = new Map();
  const tex = url => {
    if (!url) return null;
    if (!cache.has(url)) { const t = loader.load(url, () => { t.needsUpdate = true; t.userData.ready = true; }); t.encoding = THREE.sRGBEncoding; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; cache.set(url, t); }
    return cache.get(url);
  };
  const ready = t => !t || t === blank || !!t.userData.ready;
  /** start loading frames before they are needed */
  const preload = urls => { (urls || []).forEach(tex); };
  const blank = new THREE.DataTexture(new Uint8Array([10, 10, 16, 255]), 1, 1); blank.needsUpdate = true;
  const blankA = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); blankA.needsUpdate = true;
  // a title drawn into a canvas the size of the panel's face: uppercase, fitted to the width, sitting low on the left
  const titleTex = (w, h) => { const c = document.createElement('canvas'); c.width = 1024; c.height = Math.max(64, Math.round(1024 * h / w)); const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.userData.c = c; return t; };
  const drawTitle = (t, text, font) => {
    const c = t.userData.c, x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
    if (text) {
      const pad = c.width * 0.06; let px = Math.round(c.height * 0.3);
      const set = () => { x.font = (font || '500 {px}px sans-serif').replace('{px}', px); };
      set(); while (px > 20 && x.measureText(text).width > c.width - pad * 2) { px -= 4; set(); }
      x.fillStyle = '#fff'; x.textBaseline = 'alphabetic'; x.fillText(text, pad, c.height - pad * 0.9);
    }
    t.needsUpdate = true;
  };
  const api = { panels, behindRT, layer, preload };

  api.panel = (p = {}) => {
    const w = p.width || 3.2, h = p.height || 2, d = p.depth || 0.12, r = p.radius ?? Math.min(w, h) * 0.06;
    const U = {
      tBehind: { value: behindRT.texture }, tA: { value: blank }, tB: { value: blank }, uMix: { value: 1 }, uTime: { value: 0 }, uRefract: { value: 0.05 }, uDisp: { value: 0.28 },
      uLiquid: { value: 0.05 }, uRim: { value: 0.9 }, uShow: { value: 1 }, uHaveMedia: { value: 0 }, uMediaK: { value: p.mediaK ?? 0.84 }, uMediaGain: { value: p.mediaGain ?? o.mediaGain ?? 0.78 }, uAspect: { value: w / h },
      uHover: { value: 0 }, uHoverUv: { value: new THREE.Vector2(0.5, 0.5) }, uTint: { value: new THREE.Color(p.tint || '#dfe6ff') }, uRimColor: { value: new THREE.Color(p.rimColor || '#ffffff') },
      uKenA: { value: new THREE.Vector3(0, 0, 1) }, uKenB: { value: new THREE.Vector3(0, 0, 1) },
      tTA: { value: blankA }, tTB: { value: blankA }, uHaveTitle: { value: 0 }, uTitleColor: { value: new THREE.Color(p.titleColor || '#f4f1ff') }
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, transparent: true, premultipliedAlpha: true, depthWrite: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat); mesh.layers.set(layer); mesh.renderOrder = 5;
    const panel = { mesh, uniforms: U, frames: [], i: 0, t: 0, period: p.period ?? 3.2, fade: p.fade ?? 1.3, width: w, height: h, next: null, kenA: 0, kenB: 0, n: 0, ken: p.ken ?? o.ken ?? 0.07,
      title: '', nextTitle: null, font: p.titleFont || o.titleFont };
    if (p.titles) { U.tTA.value = titleTex(w, h); U.tTB.value = titleTex(w, h); U.uHaveTitle.value = 1; }
    /** the title shown now (both canvases: frames of one project share it) */
    panel.setTitle = text => { panel.title = text || ''; panel.nextTitle = null; if (p.titles) { drawTitle(U.tTA.value, panel.title, panel.font); drawTitle(U.tTB.value, panel.title, panel.font); } };
    panel.setFrames = urls => {
      panel.frames = (urls || []).filter(Boolean); panel.i = 0; panel.t = 0; panel.next = null;
      U.tA.value = tex(panel.frames[0]) || blank; U.tB.value = tex(panel.frames[1] || panel.frames[0]) || blank; U.uMix.value = 1; U.uHaveMedia.value = panel.frames.length ? 1 : 0;
      panel.kenA = panel.kenB = 0;
    };
    /** melt into another sequence: the frame on show dissolves through the liquid into the first of `urls` */
    panel.swap = (urls, o2 = {}) => {
      urls = (urls || []).filter(Boolean); if (!urls.length) return;
      if (!panel.frames.length || app.reduced || o2.instant) { panel.setFrames(urls); if (o2.title != null) panel.setTitle(o2.title); return; }
      if (urls[0] === panel.frames[panel.i] && !panel.next) { panel.frames = urls; panel.i = 0; return; }
      if (U.uMix.value < 1) {                                                          // mid-melt: land on the frame (and title) it was melting into
        U.tA.value = U.tB.value; U.uMix.value = 1; panel.kenA = panel.kenB; panel.kenB = 0;
        if (panel.nextTitle != null) { const a = U.tTA.value; U.tTA.value = U.tTB.value; U.tTB.value = a; panel.title = panel.nextTitle; panel.nextTitle = null; }
      }
      if (p.titles) { const t = o2.title != null ? o2.title : panel.title; panel.nextTitle = t; drawTitle(U.tTB.value, t, panel.font); }
      panel.next = urls; U.tB.value = tex(urls[0]); panel.t = panel.period + 1e-3;   // dissolve now (once the frame has arrived)
    };
    panel.show = k => { U.uShow.value = k; mesh.visible = k > 0.003; };
    if (p.frames) panel.setFrames(p.frames);
    panels.push(panel);
    return panel;
  };

  // per frame: draw the world without the glass into the half-size target; advance each panel's frames
  const size = new THREE.Vector2(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  app.add((t, dt) => {
    if (!panels.some(p => p.mesh.visible)) return;
    app.renderer.getDrawingBufferSize(size);
    const W = Math.max(2, Math.round(size.x * scale)), H = Math.max(2, Math.round(size.y * scale));
    if (behindRT.width !== W || behindRT.height !== H) behindRT.setSize(W, H);
    const cam = app.camera, mask = cam.layers.mask; cam.layers.set(0); for (const l of (o.behindLayers || [])) cam.layers.enable(l);
    const prev = app.renderer.getRenderTarget(), bg = app.scene.background;
    app.renderer.setRenderTarget(behindRT); app.renderer.clear(); app.renderer.render(app.scene, cam); app.renderer.setRenderTarget(prev);
    cam.layers.mask = mask; cam.layers.enable(layer);
    ndc.set(app.input.nx, app.input.ny); ray.setFromCamera(ndc, cam); ray.layers.set(layer);
    for (const pn of panels) {
      const U = pn.uniforms;
      U.uTime.value = t; U.uRefract.value = P.get('glass.refract'); U.uDisp.value = P.get('glass.dispersion'); U.uLiquid.value = P.get('glass.liquid'); U.uRim.value = P.get('glass.rim');
      // frames: hold, then dissolve to the next through the liquid (a swap to another sequence uses the same melt)
      if ((pn.frames.length > 1 || pn.next) && !app.reduced && pn.mesh.visible) {
        pn.t += dt;
        if (pn.t > pn.period && ready(U.tB.value)) {
          U.uMix.value = Math.max(0, U.uMix.value - dt / pn.fade);
          if (U.uMix.value <= 0) {
            if (pn.next) { pn.frames = pn.next; pn.next = null; pn.i = 0; } else pn.i = (pn.i + 1) % pn.frames.length;
            U.tA.value = U.tB.value; U.tB.value = tex(pn.frames[(pn.i + 1) % pn.frames.length]) || blank; U.uMix.value = 1; pn.t = 0;
            if (pn.nextTitle != null) { const a = U.tTA.value; U.tTA.value = U.tTB.value; U.tTB.value = a; pn.title = pn.nextTitle; pn.nextTitle = null; drawTitle(U.tTB.value, pn.title, pn.font); }
            pn.kenA = pn.kenB; pn.kenB = 0; pn.n++;
          }
        }
      } else if (pn.next && app.reduced) { pn.setFrames(pn.next); }
      // footage: the frame on show pushes in and drifts; the next one starts moving as it melts in
      if (!app.reduced && pn.mesh.visible) { pn.kenA += dt; if (U.uMix.value < 1) pn.kenB += dt; }
      const life = pn.period + pn.fade, kz = k => 1 - pn.ken * THREE.MathUtils.smoothstep(k, 0, life * 1.6);
      const dx = (pn.n % 2 ? 1 : -1) * 0.012, dy = (pn.n % 3 ? 1 : -1) * 0.008;
      U.uKenA.value.set(dx * Math.min(1, pn.kenA / life), dy * Math.min(1, pn.kenA / life), kz(pn.kenA));
      U.uKenB.value.set(-dx * Math.min(1, pn.kenB / life), -dy * Math.min(1, pn.kenB / life), kz(pn.kenB));
      // the pointer stirs the liquid where it touches the glass
      let h = 0;
      if (pn.mesh.visible && app.input.fine && app.input.moved) { const hit = ray.intersectObject(pn.mesh, false)[0]; if (hit && hit.uv) { U.uHoverUv.value.copy(hit.uv); h = 1; } }
      U.uHover.value += (h - U.uHover.value) * Math.min(1, dt * 5);
    }
  }, 50);
  if (!app.camera.layers.isEnabled(layer)) app.camera.layers.enable(layer);
  return api;
}
