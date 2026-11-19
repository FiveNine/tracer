/*
 * Basalt with carbonate veins, baked on the GPU into colour / normal / roughness textures.
 * The noise is 3D, sampled on the cylinder's own surface (side) or on its cut face (disk), so the side wraps without
 * a seam and the face and the side are the same stone.
 *
 *   const s = bakeStone(renderer, { seed, size: 2048 })   ->  { side: {map, normal, rough}, face: {map, normal, rough} }
 * Palette and vein density come from opts (rock, rock2, fleck, vein, veins).
 */
import * as THREE from 'three';

const NOISE = /* glsl */`
  float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  // cellular: distance to the nearest random point (round crystals and gas bubbles, never square)
  vec2 vor(vec3 x){ vec3 i = floor(x), f = fract(x); float d = 9., id = 0.;
    for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) for (int c = -1; c <= 1; c++) {
      vec3 g = vec3(a, b, c), o = vec3(h3(i + g), h3(i + g + 17.1), h3(i + g + 41.7));
      float e = length(g + o - f); if (e < d) { d = e; id = h3(i + g + 7.7); } }
    return vec2(d, id); }
  float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 6; i++){ s += a * n3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= .5; } return s; }
  // the stone at a point: rgb colour, a height (veins proud and polished, vesicles sunk), roughness
  uniform vec3 uRock, uRock2, uFleck, uFleck2, uVein; uniform float uSeed, uVeins;
  void stone(vec3 p, out vec3 col, out float h, out float rough){
    p += uSeed;
    vec3 w = vec3(fbm(p * .55), fbm(p * .55 + 7.3), fbm(p * .55 + 3.1));
    float body = fbm(p * 1.6 + w * 1.8);
    col = mix(uRock2, uRock, smoothstep(.3, .75, body));
    // banding along the core (lava flows)
    float band = fbm(vec3(p.z * 2.2, 0., 0.) + w.x);
    col *= .86 + .28 * band;
    // fine crystals: pale plagioclase laths and dark-green olivine
    vec2 c1 = vor(p * 52.), c2 = vor(p * 70. + 4.);
    col = mix(col, uFleck, smoothstep(.32, .18, c1.x) * step(.72, c1.y) * .75);
    col = mix(col, uFleck2, smoothstep(.3, .15, c2.x) * step(.8, c2.y) * .7);
    col *= .9 + .2 * n3(p * 140.);
    // vesicles: small gas bubbles, dark and sunk
    vec2 vb = vor(p * 22. + w);
    float ves = smoothstep(.2, .12, vb.x) * step(.9, vb.y);
    // carbonate veins: ridged, domain-warped, branching; this is the stored carbon
    vec3 q = p * .9 + w * 2.4;
    float r1 = 1. - abs(fbm(q) * 2. - 1.), r2 = 1. - abs(fbm(q * 1.9 + 11.) * 2. - 1.);
    float vein = smoothstep(1. - .028 * uVeins, 1. - .006 * uVeins, r1) + .7 * smoothstep(1. - .016 * uVeins, 1. - .004 * uVeins, r2);
    vein = clamp(vein, 0., 1.);
    float halo = smoothstep(1. - .07 * uVeins, 1., r1) * .25;
    col = mix(col, mix(col, uVein, .35), halo);
    col = mix(col, uVein * (.92 + .1 * n3(p * 90.)), vein);
    col = mix(col, col * .25, ves);
    h = .5 + body * .12 + vein * .25 - ves * .45 + n3(p * 120.) * .04;
    rough = mix(.58, .22, vein) + ves * .3 + (n3(p * 30.) - .5) * .1;
  }`;

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
// mode 0: side (u around, v along); mode 1: face (disk)
const BAKE = /* glsl */`
  varying vec2 vUv; uniform float uMode, uLen, uR;
  ${NOISE}
  void main(){
    vec3 p;
    if (uMode < .5) { float a = vUv.x * 6.2831853; p = vec3(cos(a) * uR, sin(a) * uR, vUv.y * uLen); }
    else { vec2 d = (vUv - .5) * 2. * uR; p = vec3(d, uLen * .5 + .37); }
    vec3 col; float h, r; stone(p, col, h, r);
    gl_FragColor = vec4(pow(clamp(col, 0., 1.), vec3(2.2)), 1.);   // stored linear (the palette is sRGB)
  }`;
const BAKE_HR = /* glsl */`
  varying vec2 vUv; uniform float uMode, uLen, uR;
  ${NOISE}
  void main(){
    vec3 p;
    if (uMode < .5) { float a = vUv.x * 6.2831853; p = vec3(cos(a) * uR, sin(a) * uR, vUv.y * uLen); }
    else { vec2 d = (vUv - .5) * 2. * uR; p = vec3(d, uLen * .5 + .37); }
    vec3 col; float h, r; stone(p, col, h, r);
    gl_FragColor = vec4(h, clamp(r, 0., 1.), 0., 1.);
  }`;
// normal from the height channel; roughness copied into G (three reads roughness from G)
const NORM = /* glsl */`
  varying vec2 vUv; uniform sampler2D tH; uniform vec2 uTexel; uniform float uStrength; uniform float uOut;
  void main(){
    float l = texture2D(tH, vUv - vec2(uTexel.x, 0.)).r, r = texture2D(tH, vUv + vec2(uTexel.x, 0.)).r;
    float d = texture2D(tH, vUv - vec2(0., uTexel.y)).r, u = texture2D(tH, vUv + vec2(0., uTexel.y)).r;
    vec3 n = normalize(vec3((l - r) * uStrength, (d - u) * uStrength, 1.));
    float rough = texture2D(tH, vUv).g;
    gl_FragColor = uOut < .5 ? vec4(n * .5 + .5, 1.) : vec4(1., rough, 0., 1.);
  }`;

export function bakeStone(renderer, o = {}) {
  const c = k => new THREE.Color(o[k]);
  const uniforms = {
    uMode: { value: 0 }, uLen: { value: o.len || 4.4 }, uR: { value: o.radius || 0.55 },
    uRock: { value: c('rock') }, uRock2: { value: c('rock2') }, uFleck: { value: c('fleck') }, uFleck2: { value: c('fleck2') }, uVein: { value: c('vein') },
    uSeed: { value: o.seed || 3.7 }, uVeins: { value: o.veins || 1 }
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad); const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mats = {
    col: new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BAKE, uniforms }),
    hr: new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BAKE_HR, uniforms }),
    norm: new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: NORM, uniforms: { tH: { value: null }, uTexel: { value: new THREE.Vector2() }, uStrength: { value: o.normal || 5 }, uOut: { value: 0 } } })
  };
  const rt = (w, h, half) => { const t = new THREE.WebGLRenderTarget(w, h, { type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping }); t.texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
  const prev = renderer.getRenderTarget();
  const tone = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
  const bake = (mode, w, h) => {
    uniforms.uMode.value = mode;
    const out = { map: rt(w, h, true), hr: rt(w, h), normal: rt(w, h), rough: rt(w, h) };
    quad.material = mats.col; renderer.setRenderTarget(out.map); renderer.render(scene, cam);
    quad.material = mats.hr; renderer.setRenderTarget(out.hr); renderer.render(scene, cam);
    mats.norm.uniforms.tH.value = out.hr.texture; mats.norm.uniforms.uTexel.value.set(1 / w, 1 / h);
    quad.material = mats.norm; mats.norm.uniforms.uOut.value = 0; renderer.setRenderTarget(out.normal); renderer.render(scene, cam);
    mats.norm.uniforms.uOut.value = 1; renderer.setRenderTarget(out.rough); renderer.render(scene, cam);
    out.hr.dispose();
    return { map: out.map.texture, normal: out.normal.texture, rough: out.rough.texture };
  };
  const S = o.size || 2048;
  const side = bake(0, S, S / 2), face = bake(1, S / 2, S / 2);
  renderer.setRenderTarget(prev); renderer.toneMapping = tone;
  return { side, face };
}
