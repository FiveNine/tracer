/*
 * Fill: once the line has drawn a shape, its solid areas fill in, in the line's own colour (no artwork: polygons
 * with holes, traced from the brand art by raw/tracy/tracy-fill.py). The fill floods up from the bottom with a soft
 * edge, and drains away as soon as the line starts to leave the shape.
 *
 *   createFill(app, line, { k, regions: [{ outer: [[x, y]…], holes: [[[x, y]…]…] }], h })
 *   k: the shape index it belongs to · h: the same height the shape was built with
 */
import * as THREE from 'three';
import { DEFORM } from './line.js';

// the fill moves exactly as the line does: the same idle wander and the same pointer nudge, vertex by vertex
const VERT = /* glsl */`
  ${DEFORM}
  varying float vY;
  void main() {
    vY = position.y;
    vec4 c = clip(wander(position));
    vec2 q = push(px(c));
    c.xy = (q / uRes * 2. - 1.) * c.w;
    gl_Position = c;
  }`;
const FRAG = /* glsl */`
  uniform vec3 uColor; uniform float uLevel, uY0, uY1, uAlpha, uTime;   // uTime is the line's
  varying float vY;
  void main() {
    // the level rises from the bottom of the shape to its top, with a gently moving, softened front
    float y = (vY - uY0) / (uY1 - uY0);
    float front = uLevel * 1.08 - .04 + sin(gl_FragCoord.x * .02 + uTime * 2.) * .006;
    float a = smoothstep(front + .012, front - .012, y) * uAlpha;
    if (a < .003) discard;
    gl_FragColor = vec4(uColor, a);
  }`;

export function createFill(app, line, o) {
  const P = app.params, h = o.h || 3.6;
  const shapes = o.regions.map(r => {
    const s = new THREE.Shape(r.outer.map(p => new THREE.Vector2(p[0] * h, p[1] * h)));
    s.holes = (r.holes || []).map(hl => new THREE.Path(hl.map(p => new THREE.Vector2(p[0] * h, p[1] * h))));
    return s;
  });
  const g = new THREE.ShapeGeometry(shapes, 1);   // polygon points are dense along every edge (the edges are what move)
  g.computeBoundingBox();
  // the line's own uniforms (time, wander, pointer, resolution) are shared, not copied
  const u = { uTime: line.uniforms.uTime, uNoise: line.uniforms.uNoise, uDpr: line.uniforms.uDpr, uPush: line.uniforms.uPush, uRes: line.uniforms.uRes, uPointer: line.uniforms.uPointer, uColor: { value: new THREE.Color() }, uLevel: { value: 0 }, uY0: { value: g.boundingBox.min.y }, uY1: { value: g.boundingBox.max.y }, uAlpha: { value: 1 } };
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
  mesh.renderOrder = 0.5;                       // over the field, under the line's glow and core
  mesh.frustumCulled = false; mesh.visible = false;
  line.group.add(mesh);

  const white = new THREE.Color('#ffffff'), blue = new THREE.Color(o.blue || '#0657ff');
  let since = -1, level = 0, target = 0;
  app.add((t, dt) => {
    const near = Math.max(0, 1 - Math.abs(P.get('line.shape') - o.k) * 7) * (P.get('line.draw') > 0.98 ? 1 : 0);
    // fill once the line has settled on the shape for a moment; drain as soon as it starts to leave
    if (near > 0.985) { if (since < 0) since = t; } else since = -1;
    if (since >= 0 && t - since > (app.reduced ? 0 : 0.35)) target = 1;
    if (near < 0.9) target = 0;
    const rate = target > level ? 0.85 : 3.5;   // fills in ~1.2 s, drains fast
    level = app.reduced ? target : Math.max(0, Math.min(1, level + Math.sign(target - level) * Math.min(Math.abs(target - level), dt * rate)));
    const eased = level * level * (3 - 2 * level);
    mesh.visible = eased > 0.001;
    u.uLevel.value = eased;
    const tv = P.get('tone.view'), tone = tv * tv * tv * (tv * (tv * 6 - 15) + 10);
    u.uColor.value.copy(white).lerp(blue, tone);      // the line's own colour: white on blue, blue on paper
    u.uAlpha.value = P.get('line.alpha') * line.fade;
  }, 12);
  return { mesh, get level() { return level; } };
}
