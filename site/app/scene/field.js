/*
 * The field: a grid of fine dots set back in depth behind the line, like the ledger the line is written on.
 * It drifts with the scroll at a slower rate than the page (parallax), lifts and brightens around the pointer,
 * and a ring of light runs through it whenever the visitor touches the line.
 *
 * Params: field.alpha (0..1) · field.lift (pointer strength) · tone (shared with the line)
 */
import * as THREE from 'three';

const VERT = /* glsl */`
  uniform float uTime, uScroll, uLift, uSize, uDpr, uRing, uRingAge;
  uniform vec3 uPtr, uRingAt;
  varying float vA;
  void main() {
    vec3 p = position;
    p.y += uScroll;                                   // parallax: the field moves slower than the page
    p.y = mod(p.y + 9., 18.) - 9.;                    // and wraps, so it never ends
    float d = distance(p.xy, uPtr.xy);
    float near = exp(-d * d / 3.2) * uLift;           // a soft lens under the pointer
    float ring = uRingAge >= 0. ? exp(-pow(distance(p.xy, uRingAt.xy) - uRingAge * 6., 2.) * 1.6) * exp(-uRingAge * 1.1) : 0.;
    p.z += near * .9 + ring * .6 + sin(p.x * .7 + uTime * .35) * cos(p.y * .6 - uTime * .28) * .08;
    vA = .45 + near * 1.6 + ring * 1.4;
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uDpr * (1. + near * .9 + ring) * (12. / -mv.z);
  }`;
const FRAG = /* glsl */`
  uniform vec3 uColor; uniform float uAlpha;
  varying float vA;
  void main() {
    float r = length(gl_PointCoord - .5);
    if (r > .5) discard;
    gl_FragColor = vec4(uColor, uAlpha * vA * smoothstep(.5, .2, r));
  }`;

export function createField(app, o = {}) {
  const P = app.params;
  P.defineAll({ 'field.alpha': [o.alpha ?? 0.22, { rate: 2 }], 'field.lift': [1, { rate: 3 }] });
  const step = app.quality === 'low' ? 0.62 : 0.46, W = 15, H = 9;
  const pos = [];
  for (let y = -H; y < H; y += step) for (let x = -W; x <= W; x += step) pos.push(x, y, 0);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const u = {
    uTime: { value: 0 }, uScroll: { value: 0 }, uLift: { value: 0 }, uSize: { value: 2.1 }, uDpr: { value: 1 },
    uPtr: { value: new THREE.Vector3(1e3, 1e3, 0) }, uRingAt: { value: new THREE.Vector3() }, uRing: { value: 0 }, uRingAge: { value: -1 },
    uColor: { value: new THREE.Color() }, uAlpha: { value: 0.2 }
  };
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, transparent: true, depthWrite: false, depthTest: false }));
  pts.position.z = o.z ?? -3.2; pts.renderOrder = 0; pts.frustumCulled = false;
  app.scene.add(pts);
  const white = new THREE.Color('#ffffff'), blue = new THREE.Color(o.blue || '#0657ff');
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -pts.position.z), hit = new THREE.Vector3(), nd = new THREE.Vector2();
  let ringT = -10, lift = 0;
  app.add((t, dt) => {
    const tv = P.get('tone.view'), tone = tv * tv * tv * (tv * (tv * 6 - 15) + 10);
    u.uColor.value.copy(white).lerp(blue, tone);
    u.uAlpha.value = P.get('field.alpha') * (0.75 + tone * 0.35);
    u.uTime.value = app.reduced ? 0 : t;
    u.uScroll.value = app.reduced ? 0 : app.scroll.y * 0.0016;
    u.uDpr.value = app.renderer.getPixelRatio();
    const I = app.input, live = I.moved && (I.fine || I.down) && !app.reduced;
    if (live) {
      nd.set(I.nx, I.ny); ray.setFromCamera(nd, app.camera);
      if (ray.ray.intersectPlane(plane, hit)) u.uPtr.value.set(hit.x, hit.y, 0);
    }
    lift += ((live ? P.get('field.lift') : 0) - lift) * Math.min(1, dt * 2.5);
    u.uLift.value = lift;
    u.uRingAge.value = t - ringT < 5 ? t - ringT : -1;
  }, 11);
  return {
    points: pts,
    /** a ring of light from a world point (the place the line was touched) */
    ring(world) { u.uRingAt.value.set(world.x, world.y, 0); ringT = app.time; }
  };
}
