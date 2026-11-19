/*
 * Post: an HDR pipeline with looks.
 *
 * scene -> HDR target (HalfFloat, 4x MSAA on WebGL2/high) -> bloom pyramid (+ optional god rays, soft copy)
 * -> one composite pass:
 *    pixelate -> chromatic aberration -> scene transition (second scene: fade / dissolve / wipe / radial)
 *    -> defocus (blur, tilt-shift) -> + bloom + rays -> exposure -> tone map (aces | neutral | filmic | reinhard | linear)
 *    -> grade (white balance, contrast, saturation, lift/gamma/gain) -> vignette -> sRGB -> stylise (dither |
 *    halftone | posterize) -> grain -> fade to a colour
 *
 * Every look value is a param ("post.bloom", "post.exposure", …), so choreography can animate it.
 * Looks: PRESETS below; pick one with createPost(app, { preset: 'product', …overrides }).
 */
import * as THREE from 'three';

export const PRESETS = {
  // Kage: moody, glowing, filmic
  cinematic: { tonemap: 'aces', exposure: 1, bloom: 0.62, threshold: 0.95, knee: 0.6, ca: 0.0045, vignette: 0.55, grain: 0.05, contrast: 1, saturation: 1, lift: [0.012, 0.016, 0.024], gain: [1.04, 0.99, 0.94] },
  // clean studio product: true colours, soft highlights, no CA
  product: { tonemap: 'neutral', exposure: 1, bloom: 0.12, threshold: 1.2, knee: 0.5, ca: 0, vignette: 0.22, grain: 0.028, contrast: 1.04, saturation: 1.02 },
  // warm analogue film: halation-like bloom, grain, gentle fade
  film: { tonemap: 'filmic', exposure: 1.05, bloom: 0.35, threshold: 0.85, knee: 0.7, ca: 0.002, vignette: 0.42, grain: 0.07, contrast: 1.06, saturation: 0.92, temperature: 0.08, lift: [0.02, 0.018, 0.014] },
  // luminous, soft, dreamy
  dream: { tonemap: 'aces', exposure: 1.08, bloom: 0.9, threshold: 0.7, knee: 0.8, ca: 0.003, vignette: 0.3, grain: 0.035, contrast: 0.94, saturation: 1.05, blur: 0.08 },
  // pale editorial pages: nearly neutral, little vignette
  editorial: { tonemap: 'neutral', exposure: 1, bloom: 0.08, threshold: 1.3, knee: 0.5, ca: 0, vignette: 0.1, grain: 0.02, contrast: 1, saturation: 1 },
  // graphic looks
  dither: { tonemap: 'neutral', exposure: 1, bloom: 0.05, threshold: 1.2, vignette: 0, grain: 0, stylize: 'dither', levels: 2 },
  halftone: { tonemap: 'neutral', exposure: 1, bloom: 0.05, threshold: 1.2, vignette: 0.1, grain: 0.01, stylize: 'halftone', cell: 7 },
  none: { tonemap: 'neutral', exposure: 1, bloom: 0, threshold: 2, vignette: 0, grain: 0, ca: 0 }
};
const TONE = { linear: 0, aces: 1, neutral: 2, filmic: 3, reinhard: 4 };
const STYLE = { none: 0, dither: 1, halftone: 2, posterize: 3 };
const TRANS = { fade: 0, dissolve: 1, wipe: 2, radial: 3 };

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const HASH = 'float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\n' +
  'float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hash12(i), hash12(i+vec2(1,0)), f.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), f.x), f.y); }\n' +
  'float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }\n';

function fsMesh(mat) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2)); const m = new THREE.Mesh(g, mat); m.frustumCulled = false; return m; }
function shader(frag, uniforms) { return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false }); }

export function createPost(app, opts = {}) {
  const { renderer } = app;
  const cfg = Object.assign({}, PRESETS[opts.preset || 'cinematic'], opts);
  const isGL2 = renderer.capabilities.isWebGL2;
  const type = (isGL2 || renderer.extensions.has('OES_texture_half_float')) ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const low = app.quality === 'low';
  const msaa = isGL2 && !low ? 4 : 0;
  const rt = (w, h, s = 0) => new THREE.WebGLRenderTarget(w, h, { type, samples: s, depthBuffer: s > 0 || false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const sceneRT = new THREE.WebGLRenderTarget(4, 4, { type, samples: msaa, depthBuffer: true });
  let sceneRTB = null; // allocated on first transition
  const LEVELS = low ? 4 : 5;
  const down = [], up = [];
  for (let i = 0; i < LEVELS; i++) { down.push(rt(4, 4)); up.push(rt(4, 4)); }
  const softA = rt(4, 4), softB = rt(4, 4), softC = rt(4, 4), raysRT = rt(4, 4);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = fsMesh(null);
  const qscene = new THREE.Scene(); qscene.add(quad);

  const prefilter = shader(
    'uniform sampler2D tMap; uniform float uThreshold, uKnee, uClamp; varying vec2 vUv;\n' +
    'void main(){ vec3 c = min(texture2D(tMap, vUv).rgb, vec3(uClamp)); float br = max(c.r, max(c.g, c.b));\n' +
    ' float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee); rq = rq * rq / (4.0 * uKnee + 1e-4);\n' +
    ' float w = max(rq, br - uThreshold) / max(br, 1e-4); gl_FragColor = vec4(c * w, 1.0); }',
    { tMap: { value: null }, uThreshold: { value: 1 }, uKnee: { value: 0.5 }, uClamp: { value: cfg.bloomClamp || 16 } });   // clamp: sharp speculars must not bloom into halos
  const downMat = shader(
    'uniform sampler2D tMap; uniform vec2 uTexel; varying vec2 vUv;\n' +
    'vec3 s(vec2 o){ return texture2D(tMap, vUv + o * uTexel).rgb; }\n' +
    'void main(){ vec3 a = s(vec2(-2,-2)), b = s(vec2(0,-2)), c = s(vec2(2,-2)), d = s(vec2(-1,-1)), e = s(vec2(1,-1)), f = s(vec2(-2,0)), g = s(vec2(0,0)),\n' +
    ' h = s(vec2(2,0)), i = s(vec2(-1,1)), j = s(vec2(1,1)), k = s(vec2(-2,2)), l = s(vec2(0,2)), m = s(vec2(2,2));\n' +
    ' vec3 o = (d + e + i + j) * 0.125 + (a + b + f + g) * 0.03125 + (b + c + g + h) * 0.03125 + (f + g + k + l) * 0.03125 + (g + h + l + m) * 0.03125;\n' +
    ' gl_FragColor = vec4(o, 1.0); }',
    { tMap: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const upMat = shader(
    'uniform sampler2D tMap; uniform sampler2D tAdd; uniform vec2 uTexel; uniform float uRadius; varying vec2 vUv;\n' +
    'vec3 s(vec2 o){ return texture2D(tMap, vUv + o * uTexel * uRadius).rgb; }\n' +
    'void main(){ vec3 o = s(vec2(-1,-1)) + s(vec2(1,-1)) + s(vec2(-1,1)) + s(vec2(1,1));\n' +
    ' o += (s(vec2(0,-1)) + s(vec2(0,1)) + s(vec2(-1,0)) + s(vec2(1,0))) * 2.0; o += s(vec2(0)) * 4.0; o /= 16.0;\n' +
    ' gl_FragColor = vec4(o + texture2D(tAdd, vUv).rgb, 1.0); }',
    { tMap: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 } });
  const blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blackTex.needsUpdate = true;
  const raysMat = shader(
    'uniform sampler2D tMap; uniform vec2 uLight; uniform float uDecay, uDensity; varying vec2 vUv;\n' +
    'void main(){ vec2 uv = vUv; vec2 d = (uv - uLight) * uDensity / 40.0; vec3 c = vec3(0.0); float w = 1.0;\n' +
    ' for (int i = 0; i < 40; i++){ uv -= d; c += texture2D(tMap, uv).rgb * w; w *= uDecay; }\n' +
    ' gl_FragColor = vec4(c / 40.0, 1.0); }',
    { tMap: { value: null }, uLight: { value: new THREE.Vector2(0.5, 0.8) }, uDecay: { value: 0.965 }, uDensity: { value: 0.9 } });

  const U = {
    tScene: { value: null }, tSceneB: { value: blackTex }, tBloom: { value: blackTex }, tRays: { value: blackTex }, tSoft: { value: blackTex },
    uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
    uExposure: { value: 1 }, uBloom: { value: 0.5 }, uRays: { value: 0 }, uRaysColor: { value: new THREE.Vector3(1, 0.92, 0.8) },
    uCA: { value: 0 }, uVignette: { value: 0.4 }, uVigColor: { value: new THREE.Vector3(0, 0, 0) }, uGrain: { value: 0.04 },
    uTone: { value: 1 }, uContrast: { value: 1 }, uSaturation: { value: 1 }, uWB: { value: new THREE.Vector3(1, 1, 1) },
    uLift: { value: new THREE.Vector3() }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) },
    uBlur: { value: 0 }, uTilt: { value: 0 }, uFocusY: { value: 0.5 }, uFocusRange: { value: 0.18 },
    uTrans: { value: 0 }, uTransType: { value: 0 }, uTransDir: { value: new THREE.Vector2(1, 0) }, uTransGlow: { value: new THREE.Vector3(1, 0.8, 0.55) },
    uStyle: { value: 0 }, uStyleMix: { value: 1 }, uLevels: { value: 2 }, uCell: { value: 7 }, uInk: { value: new THREE.Vector3(0.05, 0.05, 0.06) }, uPaper: { value: new THREE.Vector3(0.95, 0.93, 0.88) },
    uPixel: { value: 0 }, uFade: { value: 1 }, uFadeColor: { value: new THREE.Vector3(0, 0, 0) }
  };
  const composite = shader([
    'uniform sampler2D tScene, tSceneB, tBloom, tRays, tSoft; uniform vec2 uRes; uniform float uTime;',
    'uniform float uExposure, uBloom, uRays, uCA, uVignette, uGrain, uTone, uContrast, uSaturation, uBlur, uTilt, uFocusY, uFocusRange;',
    'uniform vec3 uRaysColor, uVigColor, uWB, uLift, uGamma, uGain, uTransGlow, uInk, uPaper, uFadeColor;',
    'uniform float uTrans, uTransType, uStyle, uStyleMix, uLevels, uCell, uPixel, uFade; uniform vec2 uTransDir;',
    'varying vec2 vUv;', HASH,
    'vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }',
    // Khronos PBR Neutral: keeps base colours true (products, photography)
    'vec3 neutral(vec3 c){ float x = min(c.r, min(c.g, c.b)); float off = x < 0.08 ? x - 6.25 * x * x : 0.04; c -= off;',
    ' float peak = max(c.r, max(c.g, c.b)); if (peak < 0.76) return c; float d = 0.24; float np = 1.0 - d * d / (peak + d - 0.76);',
    ' c *= np / peak; float g = 1.0 - 1.0 / (0.15 * (peak - np) + 1.0); return mix(c, vec3(np), g); }',
    'vec3 hable(vec3 x){ return ((x * (0.15 * x + 0.05) + 0.004) / (x * (0.15 * x + 0.5) + 0.06)) - 0.0666; }',
    'vec3 filmic(vec3 x){ return clamp(hable(x * 2.0) / hable(vec3(11.2)), 0.0, 1.0); }',
    'vec3 tonemap(vec3 c){ if (uTone < 0.5) return clamp(c, 0.0, 1.0); if (uTone < 1.5) return aces(c); if (uTone < 2.5) return clamp(neutral(c), 0.0, 1.0); if (uTone < 3.5) return filmic(c); return c / (1.0 + c); }',
    'vec3 toSRGB(vec3 c){ c = max(c, vec3(0.0)); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }',
    'float bayer(vec2 p){ vec2 q = mod(floor(p), 4.0); int i = int(q.x + q.y * 4.0);',
    ' float m = 0.0; if (i==0) m=0.0; else if (i==1) m=8.0; else if (i==2) m=2.0; else if (i==3) m=10.0; else if (i==4) m=12.0; else if (i==5) m=4.0; else if (i==6) m=14.0; else if (i==7) m=6.0;',
    ' else if (i==8) m=3.0; else if (i==9) m=11.0; else if (i==10) m=1.0; else if (i==11) m=9.0; else if (i==12) m=15.0; else if (i==13) m=7.0; else if (i==14) m=13.0; else m=5.0; return (m + 0.5) / 16.0; }',
    'float transMask(vec2 uv, out float edge){',
    ' float t = uTrans, m; vec2 asp = vec2(uRes.x / uRes.y, 1.0);',
    ' if (uTransType < 0.5) { m = t; edge = 0.0; return m; }',
    ' float s = 0.12, p;',
    ' if (uTransType < 1.5) { p = fbm(uv * asp * 3.0 + 3.7); }',
    ' else if (uTransType < 2.5) { p = dot(uv - 0.5, normalize(uTransDir)) + 0.5; p += (fbm(uv * asp * 4.0) - 0.5) * 0.08; }',
    ' else { p = length((uv - 0.5) * asp) / 0.9; p += (fbm(uv * asp * 5.0) - 0.5) * 0.06; }',
    ' float x = t * (1.0 + 2.0 * s) - s; m = smoothstep(p - s, p + s, x); edge = 1.0 - abs(m * 2.0 - 1.0); return m; }',
    'void main(){',
    ' vec2 uv = vUv;',
    ' if (uPixel > 0.5) { vec2 px = uRes / uPixel; uv = (floor(uv * px) + 0.5) / px; }',
    ' vec2 d = uv - 0.5; float r2 = dot(d, d);',
    ' vec2 off = d * uCA * (0.25 + r2 * 2.0);',
    ' vec3 col = vec3(texture2D(tScene, uv + off).r, texture2D(tScene, uv).g, texture2D(tScene, uv - off).b);',
    ' if (uTrans > 0.0005) { float edge; float m = transMask(uv, edge);',
    '   vec2 w = (vec2(fbm(uv * 6.0 + uTime * 0.2), fbm(uv * 6.0 - 4.0)) - 0.5) * 0.04 * edge;',
    '   vec3 a = texture2D(tScene, uv + w).rgb, b = texture2D(tSceneB, uv - w).rgb;',
    '   col = mix(a, b, m) + uTransGlow * edge * edge * step(0.5, uTransType) * 0.6; }',
    ' float focus = max(uBlur, uTilt * smoothstep(uFocusRange * 0.5, uFocusRange * 1.8, abs(uv.y - uFocusY)));',
    ' if (focus > 0.002) col = mix(col, texture2D(tSoft, uv).rgb, clamp(focus, 0.0, 1.0));',
    ' col += texture2D(tBloom, uv).rgb * uBloom;',
    ' if (uRays > 0.001) col += texture2D(tRays, uv).rgb * uRays * uRaysColor;',
    ' col *= uExposure * uWB;',
    ' col = tonemap(col);',
    ' float l = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    ' col = mix(vec3(l), col, uSaturation);',
    ' col = (col - 0.5) * uContrast + 0.5;',
    ' col = pow(max(col, 0.0) * uGain + uLift * (1.0 - col), 1.0 / uGamma);',
    ' float vig = smoothstep(0.25, 1.0, length(d * vec2(1.0, 0.92)) * 1.28);',
    ' col = mix(col, uVigColor, uVignette * vig);',
    ' col = toSRGB(col);',
    ' if (uStyle > 0.5) { vec3 st = col; float L = dot(col, vec3(0.299, 0.587, 0.114)); vec2 fc = vUv * uRes;',
    '   if (uStyle < 1.5) { float q = floor(L * (uLevels - 1.0) + bayer(fc / max(1.0, uPixel)) ) / (uLevels - 1.0); st = mix(uInk, uPaper, clamp(q, 0.0, 1.0)); }',
    '   else if (uStyle < 2.5) { float a = 0.785; mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a)); vec2 g = R * fc / uCell; vec2 c = fract(g) - 0.5; float rad = sqrt(1.0 - L) * 0.62; float dot0 = 1.0 - smoothstep(rad - 0.08, rad + 0.08, length(c)); st = mix(uPaper, uInk, dot0); }',
    '   else { st = floor(col * uLevels + 0.5) / uLevels; }',
    '   col = mix(col, st, uStyleMix); }',
    ' col += (hash12(vUv * uRes + fract(uTime * 13.0) * 97.0) - 0.5) * uGrain;',
    ' col = mix(uFadeColor, col, uFade);',
    ' gl_FragColor = vec4(col, 1.0); }'
  ].join('\n'), U);

  // look values that can be animated live through params
  const P = app.params;
  const vec3 = v => Array.isArray(v) ? v : [v, v, v];
  const LIVE = {
    exposure: 1, bloom: 0.5, threshold: 1, knee: 0.5, rays: 0, raysX: 0.5, raysY: 0.8, raysDecay: 0.965, raysDensity: 0.9,
    ca: 0, vignette: 0.4, grain: 0.04, contrast: 1, saturation: 1, temperature: 0, tint: 0,
    lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], blur: 0, tilt: 0, focusY: 0.5, focusRange: 0.18,
    transition: 0, fade: 1, styleMix: 1, pixel: 0
  };
  for (const k in LIVE) P.define('post.' + k, cfg[k] != null ? (Array.isArray(LIVE[k]) ? vec3(cfg[k]) : cfg[k]) : LIVE[k], { rate: k === 'fade' ? 2.2 : 3, group: 'post' });

  const col3 = (hex, fb) => { const c = new THREE.Color(hex || fb); return new THREE.Vector3(c.r, c.g, c.b); };
  const api = {
    cfg, sceneRT,
    /** static look settings: tonemap, stylize, levels, cell, colours, transitionType … */
    set(o) {
      Object.assign(cfg, o);
      U.uTone.value = TONE[cfg.tonemap || 'aces'] ?? 1;
      U.uStyle.value = STYLE[cfg.stylize || 'none'] ?? 0;
      U.uLevels.value = cfg.levels || 2; U.uCell.value = cfg.cell || 7;
      if (cfg.ink) U.uInk.value.copy(col3(cfg.ink)); if (cfg.paper) U.uPaper.value.copy(col3(cfg.paper));
      if (cfg.vignetteColor) U.uVigColor.value.copy(col3(cfg.vignetteColor));
      if (cfg.fadeColor) U.uFadeColor.value.copy(col3(cfg.fadeColor));
      if (cfg.raysColor) U.uRaysColor.value.copy(col3(cfg.raysColor));
      if (cfg.transitionGlow) U.uTransGlow.value.copy(col3(cfg.transitionGlow));
      U.uTransType.value = TRANS[cfg.transitionType || 'dissolve'] ?? 1;
      if (cfg.transitionDir) U.uTransDir.value.set(cfg.transitionDir[0], cfg.transitionDir[1]);
      return api;
    },
    setSize(w, h) {
      sceneRT.setSize(w, h); if (sceneRTB) sceneRTB.setSize(w, h);
      let bw = Math.max(1, Math.round(w / (low ? 4 : 2))), bh = Math.max(1, Math.round(h / (low ? 4 : 2)));
      for (let i = 0; i < LEVELS; i++) { down[i].setSize(bw, bh); up[i].setSize(bw, bh); bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1); }
      const qw = Math.max(1, Math.round(w / 4)), qh = Math.max(1, Math.round(h / 4));
      softA.setSize(Math.round(w / 2), Math.round(h / 2)); softB.setSize(qw, qh); softC.setSize(qw, qh); raysRT.setSize(qw, qh);
      U.uRes.value.set(w, h);
    },
    /** render a scene (and, during a transition, a second one) through the whole pipeline to the screen */
    render(scene, camera, sceneB, cameraB) {
      const g = n => P.get('post.' + n);
      renderer.setRenderTarget(sceneRT); renderer.clear(); renderer.render(scene, camera);
      const trans = g('transition');
      if (sceneB && trans > 0.0005) {
        if (!sceneRTB) { sceneRTB = new THREE.WebGLRenderTarget(sceneRT.width, sceneRT.height, { type, samples: msaa, depthBuffer: true }); }
        renderer.setRenderTarget(sceneRTB); renderer.clear(); renderer.render(sceneB, cameraB || camera);
        U.tSceneB.value = sceneRTB.texture;
      } else U.tSceneB.value = sceneRT.texture;
      // bloom
      const bloom = g('bloom');
      if (bloom > 0.001 || g('rays') > 0.001) {
        prefilter.uniforms.tMap.value = sceneRT.texture; prefilter.uniforms.uThreshold.value = g('threshold'); prefilter.uniforms.uKnee.value = g('knee');
        pass(prefilter, down[0]);
        for (let i = 1; i < LEVELS; i++) { downMat.uniforms.tMap.value = down[i - 1].texture; downMat.uniforms.uTexel.value.set(1 / down[i - 1].width, 1 / down[i - 1].height); pass(downMat, down[i]); }
        let src = down[LEVELS - 1];
        for (let i = LEVELS - 2; i >= 0; i--) { upMat.uniforms.tMap.value = src.texture; upMat.uniforms.tAdd.value = down[i].texture; upMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height); pass(upMat, up[i]); src = up[i]; }
        U.tBloom.value = up[0].texture;
        if (g('rays') > 0.001) {
          raysMat.uniforms.tMap.value = down[0].texture; raysMat.uniforms.uLight.value.set(g('raysX'), g('raysY'));
          raysMat.uniforms.uDecay.value = g('raysDecay'); raysMat.uniforms.uDensity.value = g('raysDensity');
          pass(raysMat, raysRT); U.tRays.value = raysRT.texture;
        }
      } else U.tBloom.value = blackTex;
      // soft copy for defocus / tilt-shift
      if (g('blur') > 0.002 || g('tilt') > 0.002) {
        downMat.uniforms.tMap.value = sceneRT.texture; downMat.uniforms.uTexel.value.set(1 / sceneRT.width, 1 / sceneRT.height); pass(downMat, softA);
        downMat.uniforms.tMap.value = softA.texture; downMat.uniforms.uTexel.value.set(1 / softA.width, 1 / softA.height); pass(downMat, softB);
        upMat.uniforms.tMap.value = softB.texture; upMat.uniforms.tAdd.value = blackTex; upMat.uniforms.uTexel.value.set(1 / softB.width, 1 / softB.height); upMat.uniforms.uRadius.value = 2.0; pass(upMat, softC);
        upMat.uniforms.uRadius.value = 1.0;
        U.tSoft.value = softC.texture;
      }
      // composite
      U.tScene.value = sceneRT.texture; U.uTime.value = app.time;
      U.uExposure.value = g('exposure'); U.uBloom.value = bloom; U.uRays.value = g('rays');
      U.uCA.value = g('ca'); U.uVignette.value = g('vignette'); U.uGrain.value = g('grain');
      U.uContrast.value = g('contrast'); U.uSaturation.value = g('saturation');
      const t = g('temperature'), ti = g('tint'); U.uWB.value.set(1 + t * 0.35, 1 + ti * 0.2, 1 - t * 0.35);
      const L = g('lift'), G = g('gamma'), Gn = g('gain'); U.uLift.value.set(L[0], L[1], L[2]); U.uGamma.value.set(G[0], G[1], G[2]); U.uGain.value.set(Gn[0], Gn[1], Gn[2]);
      U.uBlur.value = g('blur'); U.uTilt.value = g('tilt'); U.uFocusY.value = g('focusY'); U.uFocusRange.value = g('focusRange');
      U.uTrans.value = sceneB ? trans : 0; U.uFade.value = g('fade'); U.uStyleMix.value = g('styleMix'); U.uPixel.value = g('pixel');
      quad.material = composite; renderer.setRenderTarget(null); renderer.render(qscene, cam);
    },
    dispose() { [sceneRT, sceneRTB, softA, softB, softC, raysRT].concat(down, up).forEach(r => r && r.dispose()); }
  };
  function pass(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qscene, cam); }
  api.set({});
  return api;
}
