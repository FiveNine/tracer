/*
 * Discs: round windows on the line. The line draws each window's rim; once it has settled, a photo opens inside each
 * rim like an iris, one after another, and closes again as soon as the line moves on. The windows are part of the line's
 * world: same group, same idle wander and same pointer nudge (DEFORM), so they bend with it.
 *
 *   createDiscs(app, line, { k, discs: [{ x, y, r }], photos: ['assets/…'] })
 */
import * as THREE from 'three';
import { DEFORM } from './line.js';

const VERT = /* glsl */`
  ${DEFORM}
  varying vec2 vL;
  void main() {
    vL = uv * 2. - 1.;                                   // -1..1 across the window
    vec4 c = clip(wander(position));
    vec2 q = push(px(c));
    c.xy = (q / uRes * 2. - 1.) * c.w;
    gl_Position = c;
  }`;
const FRAG = /* glsl */`
  uniform sampler2D uImg; uniform float uOpen, uAlpha, uTime, uSeed, uR; uniform vec3 uBg;
  varying vec2 vL;
  vec3 lin(vec3 c) { return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c)); }   // the photo's sRGB, decoded here (three r149 has no colorSpace)
  void main() {
    float d = length(vL);
    // the iris: a soft-edged opening that grows from the centre to the rim (uR: the rim in px, for a 1px-soft edge)
    float edge = 1.4 / uR;
    float open = smoothstep(uOpen + edge, uOpen - edge, d);
    if (open * uAlpha < .003) discard;
    // the photo breathes very slowly, and settles in from a little closer as the window opens
    float z = 1. - .1 * (1. - uOpen) - .025 * sin(uTime * .18 + uSeed);
    vec2 uv = vL * .5 * z + .5 + vec2(sin(uTime * .11 + uSeed), cos(uTime * .09 + uSeed)) * .012;
    vec3 col = lin(texture2D(uImg, uv).rgb);
    // a little of the world's colour gathers at the rim, so the photo sits in the window rather than on it
    col = mix(col, uBg, smoothstep(.72, 1., d) * .22);
    gl_FragColor = vec4(col, open * uAlpha);
  }`;

export async function createDiscs(app, line, o) {
  const P = app.params;
  const loader = new THREE.TextureLoader();
  const tex = await Promise.all(o.photos.map(src => loader.loadAsync(src).then(t => { t.anisotropy = 4; return t; }).catch(() => null)));
  const L = line.uniforms;
  const items = o.discs.map((d, i) => {
    const g = new THREE.CircleGeometry(d.r, 128);
    g.translate(d.x, d.y, 0);
    const u = {
      uTime: L.uTime, uNoise: L.uNoise, uDpr: L.uDpr, uPush: L.uPush, uRes: L.uRes, uPointer: L.uPointer, uBg: L.uBg,
      uImg: { value: tex[i] }, uOpen: { value: 0 }, uAlpha: { value: 1 }, uSeed: { value: i * 1.7 }, uR: { value: 100 }
    };
    const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
    mesh.renderOrder = 0.5;                     // over the field, under the line's glow and core
    mesh.frustumCulled = false; mesh.visible = false;
    line.group.add(mesh);
    return { mesh, u, d, level: 0, want: 0 };
  }).filter((it, i) => tex[i]);

  let since = -1;
  const v = new THREE.Vector3();
  app.add((t, dt) => {
    const near = Math.max(0, 1 - Math.abs(P.get('line.shape') - o.k) * 7) * (P.get('line.draw') > 0.98 ? 1 : 0);
    if (near > 0.985) { if (since < 0) since = t; } else since = -1;
    const alpha = P.get('line.alpha') * line.fade;
    // the rim's radius on screen, for an edge that stays 1px soft at any size
    const rpx = (line.group.scale.x * app.height / (2 * Math.tan(THREE.MathUtils.degToRad(app.camera.fov / 2)) * app.camera.position.z)) * app.renderer.getPixelRatio();
    items.forEach((it, i) => {
      // open one after another once the line has settled; close fast as soon as it starts to leave
      if (since >= 0 && t - since > (app.reduced ? 0 : 0.25 + i * 0.16)) it.want = 1;
      if (near < 0.9) it.want = 0;
      const want = it.want, rate = want > it.level ? 1.1 : 4;
      it.level = app.reduced ? want : Math.max(0, Math.min(1, it.level + Math.sign(want - it.level) * Math.min(Math.abs(want - it.level), dt * rate)));
      const e = 1 - Math.pow(1 - it.level, 3);
      it.u.uOpen.value = e * 1.002;
      it.u.uAlpha.value = alpha;
      it.u.uR.value = it.d.r * rpx;
      it.mesh.visible = e > 0.001 && alpha > 0.003;
    });
  }, 12);
  return { items, center(i, out = v) { const d = o.discs[i]; return out.set(d.x, d.y, 0).applyMatrix4(line.group.matrixWorld); } };
}
