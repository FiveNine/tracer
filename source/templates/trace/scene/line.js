/*
 * The trace: one line of light, N points long, drawn as a screen-space ribbon (constant width in pixels) plus a soft
 * halo. Every shape the page uses is a row of one float texture; the vertex shader blends row floor(shape) into the
 * next with a stagger along the line, so a chapter change is the line re-routing itself from its start to its end.
 *
 * Params
 *   line.shape   float index into the page's shapes (keys move it 0 -> 1 -> 2 …)
 *   line.draw    0..1 how much of the line is drawn (the intro traces it)
 *   line.x/y     placement in half-view units (-1..1) · line.s scale · line.rx/ry tilt (radians)
 *   line.w       width in CSS px · line.halo halo strength · line.noise wander during a change
 *   pulse.amt    the signal that runs along the line (0 = none) · pulse.speed laps per second
 *   tone         0 = blue world (white line), 1 = paper world (blue line)
 */
import * as THREE from 'three';

/** How the line moves, as one GLSL chunk: anything drawn as part of the line (Tracy's fill) includes it and is given the
 *  line's uniforms, so it wanders with the line and gives way to the pointer exactly as the line does.
 *  wander(p): the idle drift, a function of position in the shape's own space · push(q): the pointer's nudge, in pixels */
export const DEFORM = /* glsl */`
  uniform float uTime, uNoise, uDpr, uPush;
  uniform vec2 uRes, uPointer;
  vec3 wander(vec3 p) { return p + uNoise * .04 * vec3(sin(p.y * 2.3 + uTime * .5), cos(p.x * 2.1 + uTime * .43), 0.); }
  vec4 clip(vec3 p) { return projectionMatrix * modelViewMatrix * vec4(p, 1.); }
  vec2 px(vec4 c) { return (c.xy / c.w * .5 + .5) * uRes; }
  vec2 push(vec2 q) {
    vec2 d = q - uPointer; float l = length(d), R = 70. * uDpr;
    return q + (l > .001 ? d / l : vec2(0.)) * uPush * R * .12 * exp(-(l * l) / (R * R));   // a nudge, never a bend
  }`;

const VERT = /* glsl */`
  precision highp sampler2D;   // vertex samplers default to lowp: positions would be quantised to garbage
  attribute float aI;
  attribute float aSide;
  uniform sampler2D uShapes;
  uniform float uN, uK, uShape, uStagger, uWidth;
  varying float vSide, vU, vVis, vW;
  ${DEFORM}

  vec4 sh(float i, float k) { return texture2D(uShapes, vec2((i + .5) / uN, (k + .5) / uK)); }
  vec4 at(float i) {
    i = clamp(i, 0., uN - 1.);
    float s = clamp(uShape, 0., uK - 1.);
    float k0 = floor(s), f = s - k0, k1 = min(k0 + 1., uK - 1.);
    float u = i / (uN - 1.);
    float g = smoothstep(0., 1., clamp(f * (1. + uStagger) - u * uStagger, 0., 1.));
    vec4 A = sh(i, k0), B = sh(i, k1);
    vec4 p = mix(A, B, g);
    // visibility while re-routing: a point that is part of a hidden jump in either shape fades out as soon as it starts
    // moving (or only appears once it has arrived), so it never draws a streak across the screen on its way
    float both = min(A.w, B.w);
    p.w = both + (A.w - both) * (1. - smoothstep(0., .3, g)) + (B.w - both) * smoothstep(.7, 1., g);
    float tr = g * (1. - g) * 4.;
    p.xyz += tr * uNoise * vec3(sin(u * 23. + uTime * 1.3 + k0 * 1.7), cos(u * 17. - uTime * 1.1), sin(u * 11. + uTime) * 2.);
    p.xyz = wander(p.xyz);   // it is never quite still
    return p;
  }
  void main() {
    // neighbours two samples away: one-sample jitter in a traced outline would make the tangent flicker
    vec4 a = at(aI - 2.), b = at(aI), c = at(aI + 2.);
    vec4 cb = clip(b.xyz);
    vec2 pa = push(px(clip(a.xyz))), pb = push(px(cb)), pc = push(px(clip(c.xyz)));
    // direction from the visible neighbours only: across a hidden jump the far sample would twist the ribbon
    vec2 ta = pb - pa, tc = pc - pb;
    bool okA = a.w > .001 && length(ta) > .05, okC = c.w > .001 && length(tc) > .05;
    vec2 t = okA && okC ? normalize(ta) + normalize(tc) : okA ? ta : okC ? tc : vec2(1., 0.);
    t = length(t) > 1e-4 ? normalize(t) : vec2(1., 0.);
    vec2 n = vec2(-t.y, t.x);
    // a sharp turn narrows the ribbon, so the halo never sprays spikes at corners
    float bend = okA && okC ? dot(normalize(ta), normalize(tc)) : 1.;
    float k = mix(.35, 1., smoothstep(-.7, .1, bend)) * step(.001, b.w);
    vec2 q = pb + n * aSide * uWidth * .5 * k;
    cb.xy = (q / uRes * 2. - 1.) * cb.w;
    gl_Position = cb;
    vSide = aSide; vU = aI / (uN - 1.); vVis = b.w; vW = uWidth;
  }`;

const FRAG = /* glsl */`
  uniform vec3 uColor, uHot, uBg;
  uniform float uAlpha, uHalo, uDraw, uStart, uPulse, uPulseAmt, uClickU, uClickAge, uTime, uDpr;
  uniform vec4 uClip;      // drawing-buffer px (x0, y0, x1, y1), y up: the line shows only inside, feathered top and bottom
  varying float vSide, vU, vVis, vW;
  void main() {
    if (vU > uDraw + .002 || vU < uStart - .002) discard;   // drawn from 0 to uDraw; erased from 0 up to uStart
    vec2 f = gl_FragCoord.xy;
    float clip = step(uClip.x, f.x) * step(f.x, uClip.z) * smoothstep(uClip.y, uClip.y + 36. * uDpr, f.y) * smoothstep(uClip.w, uClip.w - 36. * uDpr, f.y);
    if (clip < .002) discard;
    float e = abs(vSide);
    float body;
    if (uHalo > 0.) body = exp(-e * e * 3.) * uHalo;
    else { float aa = min(.5, 1.6 / max(vW, 1.)); body = 1. - smoothstep(1. - aa, 1., e); }
    // the signal: a short bright run with a long tail, travelling with u
    float d = fract(uPulse - vU);
    float sig = uPulseAmt * (exp(-d * 90.) + .35 * exp(-d * 9.)) ;
    // a touch sends two fronts out from where the hand met the line
    float front = abs(abs(vU - uClickU) - uClickAge * .22);
    float touch = exp(-front * 70.) * exp(-uClickAge * .9) * step(0., uClickAge) * 1.4;
    // the drawing head glows while the line is being traced
    float head = (1. - smoothstep(0., .03, uDraw - vU)) * step(uDraw, .999) * 1.2;
    float hot = clamp(sig + touch + head, 0., 1.6);
    vec3 col = mix(uColor, uHot, clamp(hot, 0., 1.));
    // the pulse brightens what is drawn; it never reveals the hidden jumps between strokes
    float tail = smoothstep(uStart, uStart + .025, vU);   // the erasing end thins out rather than cutting off
    float a = tail * body * uAlpha * clip * min(1., vVis * (1. + hot * 1.4)) * step(.001, vVis);
    if (a < .003) discard;
    // the final colour over the ground; blended with MAX (blue world) or MIN (paper world), so where the line crosses or
    // retraces itself, or the halo meets the core, the brightest value wins instead of the layers adding up
    gl_FragColor = vec4(mix(uBg, col, clamp(a, 0., 1.)), 1.);
  }`;

export function createLine(app, o) {
  const P = app.params, N = o.N || 2048, K = o.shapes.length;
  P.defineAll({
    'line.shape': [0, { rate: 2.4 }], 'line.draw': [1, { rate: 4 }], 'line.start': [0, { rate: 4 }], 'line.x': 0, 'line.y': 0, 'line.s': 1,
    'line.rx': 0, 'line.ry': 0, 'line.w': 2.4, 'line.halo': 0.22, 'line.noise': 0.12, 'line.alpha': 1,
    'pulse.amt': [0.8, { rate: 2 }], 'pulse.speed': 0.07
  });
  const bounds = o.shapes.map(sh => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < N; i++) { if (sh.data[i * 4 + 3] <= 0) continue; const x = sh.data[i * 4], y = sh.data[i * 4 + 1]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return [x0, y0, x1, y1];
  });
  const data = new Float32Array(N * K * 4);
  o.shapes.forEach((s, k) => data.set(s.data, k * N * 4));
  const tex = new THREE.DataTexture(data, N, K, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;

  const g = new THREE.BufferGeometry();
  const aI = new Float32Array(N * 2), aSide = new Float32Array(N * 2), idx = [];
  for (let i = 0; i < N; i++) { aI[i * 2] = aI[i * 2 + 1] = i; aSide[i * 2] = -1; aSide[i * 2 + 1] = 1; }
  for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
  g.setAttribute('aI', new THREE.BufferAttribute(aI, 1));
  g.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1));
  g.setIndex(idx);

  const common = {
    uShapes: { value: tex }, uN: { value: N }, uK: { value: K }, uShape: { value: 0 }, uStagger: { value: 0.7 },
    uTime: { value: 0 }, uNoise: { value: 0.3 }, uRes: { value: new THREE.Vector2(1, 1) }, uDpr: { value: 1 },
    uPointer: { value: new THREE.Vector2(-1e4, -1e4) }, uPush: { value: 0 }, uClip: { value: new THREE.Vector4(-1e5, -1e5, 1e5, 1e5) },
    uColor: { value: new THREE.Color() }, uHot: { value: new THREE.Color() }, uDraw: { value: 1 }, uStart: { value: 0 },
    uPulse: { value: 0 }, uPulseAmt: { value: 0 }, uClickU: { value: 0 }, uClickAge: { value: -1 }, uBg: { value: new THREE.Color() }
  };
  // two passes over one geometry: a wide soft halo, then the crisp line (the shared uniforms are the same objects)
  const matOf = halo => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,   // the ribbon's winding flips with its direction
    blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    uniforms: Object.assign({}, common, { uWidth: { value: 2 }, uAlpha: { value: 1 }, uHalo: { value: halo } })
  });
  const halo = new THREE.Mesh(g, matOf(1)), core = new THREE.Mesh(g, matOf(0));
  halo.frustumCulled = core.frustumCulled = false; halo.renderOrder = 1; core.renderOrder = 2;
  const group = new THREE.Group(); group.add(halo, core); app.scene.add(group);

  const cBlue = new THREE.Color(o.colors.blue), cPaper = new THREE.Color(o.colors.paper), cWhite = new THREE.Color('#ffffff');
  const cHotBlue = new THREE.Color(o.colors.hotOnBlue || '#d9f1ff'), cHotPaper = new THREE.Color(o.colors.hotOnPaper || o.colors.blue);
  const bg = new THREE.Color(), tmp = new THREE.Color();
  let pulse = 0, clickT = -10;
  const ptr = new THREE.Vector2(-1e4, -1e4);
  let pushK = 0;

  app.add((t, dt) => {
    const tv = P.get('tone.view'), tone = tv * tv * tv * (tv * (tv * 6 - 15) + 10);   // smootherstep: little time in the in-between lavender
    bg.copy(cBlue).lerp(cPaper, tone);
    app.renderer.setClearColor(bg, 1);
    common.uBg.value.copy(bg);
    const eq = tone < 0.5 ? THREE.MaxEquation : THREE.MinEquation;
    if (core.material.blendEquation !== eq) { core.material.blendEquation = halo.material.blendEquation = eq; }
    const w = app.width, h = app.height, dpr = app.renderer.getPixelRatio();
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(app.camera.fov / 2)) * app.camera.position.z, vw = vh * app.camera.aspect;
    group.position.set(P.get('line.x') * vw / 2, (P.get('line.y') + api.dy) * vh / 2, 0);   // dy: carried with the page (app.js carry())
    group.scale.setScalar(P.get('line.s'));
    group.rotation.set(P.get('line.rx'), P.get('line.ry'), 0);
    pulse = (pulse + dt * P.get('pulse.speed') * (app.reduced ? 0 : 1)) % 1;
    // the pointer, in drawing-buffer pixels (y up); its push eases in when it moves and out when it rests
    const I = app.input, live = I.moved && (I.fine || I.down);
    if (live) ptr.set(I.x * dpr, (h - I.y) * dpr);
    pushK += ((live ? 1 : 0) - pushK) * Math.min(1, dt * 3);
    { const u = common;
      u.uTime.value = app.reduced ? 0 : t;
      u.uShape.value = P.get('line.shape');
      u.uDraw.value = P.get('line.draw'); u.uStart.value = P.get('line.start');
      u.uNoise.value = P.get('line.noise') * (app.reduced ? 0 : 1);
      u.uRes.value.set(w * dpr, h * dpr); u.uDpr.value = dpr;
      u.uPointer.value.copy(ptr); u.uPush.value = app.reduced ? 0 : pushK;
      u.uPulse.value = pulse; u.uPulseAmt.value = P.get('pulse.amt');
      u.uClickAge.value = t - clickT > 6 ? -1 : t - clickT;
    }
    core.material.uniforms.uWidth.value = P.get('line.w') * dpr;
    core.material.uniforms.uAlpha.value = P.get('line.alpha') * api.fade;
    halo.material.uniforms.uWidth.value = P.get('line.w') * dpr * 9;
    halo.material.uniforms.uAlpha.value = P.get('line.alpha') * P.get('line.halo') * api.fade * (1 - tone * 0.45);   // on paper the ink needs less glow
    tmp.copy(cWhite).lerp(cBlue, tone);
    core.material.uniforms.uColor.value.copy(tmp); halo.material.uniforms.uColor.value.copy(tmp);
    tmp.copy(cHotBlue).lerp(cHotPaper, tone);
    core.material.uniforms.uHot.value.copy(tmp); halo.material.uniforms.uHot.value.copy(tmp);
  }, 10);

  const v = new THREE.Vector3();
  const api = {
    group, N, shapes: o.shapes, texture: tex,
    uniforms: common,   // shared with anything drawn as part of the line (see DEFORM)
    /** the line's box on screen in its current shape (CSS px): for keeping it clear of the words */
    screenBox(out = {}) {
      const k = Math.max(0, Math.min(K - 1, Math.round(P.get('line.shape')))), b = bounds[k];
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [x, y] of [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]]) {
        v.set(x, y, 0).applyMatrix4(group.matrixWorld).project(app.camera);
        const sx = (v.x + 1) / 2 * app.width, sy = (1 - v.y) / 2 * app.height;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      return Object.assign(out, { left: x0, top: y0, right: x1, bottom: y1 });
    },
    /** the shape's bounds in its own units [x0, y0, x1, y1] */
    bounds: k => bounds[k],
    /** an extra multiplier on the whole line (it steps back while copy crosses it) */
    fade: 1,
    /** an extra vertical offset in half-view units, applied straight away (no easing): moves the line with the page */
    dy: 0,
    /** world position of a node of shape k (labels) */
    node(k, id, out = new THREE.Vector3()) {
      const s = o.shapes[k]; const p = s && s.nodes[id]; if (!p) return null;
      return out.set(p[0], p[1], p[2]).applyMatrix4(group.matrixWorld);
    },
    /** world position of the line at u in its current shape (nearest integer shape) */
    pointAt(u, out = new THREE.Vector3()) {
      const k = Math.max(0, Math.min(K - 1, Math.round(P.get('line.shape')))), i = Math.round(u * (N - 1)), d = o.shapes[k].data;
      return out.set(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]).applyMatrix4(group.matrixWorld);
    },
    /** send a signal from u (both directions) */
    touch(u) { common.uClickU.value = u; clickT = app.time; },
    /** the u nearest to a screen point (CSS px), within maxPx, or -1 */
    nearest(x, y, maxPx = 70) {
      const k = Math.round(P.get('line.shape')), s = o.shapes[Math.max(0, Math.min(K - 1, k))];
      if (!s || P.get('line.alpha') * api.fade < 0.25) return -1;   // a line that has stepped back can't be touched
      group.updateMatrixWorld();
      let best = -1, bd = maxPx * maxPx;
      for (let i = 0; i < N; i += 2) {
        if (s.data[i * 4 + 3] < 0.05 || i / (N - 1) > P.get('line.draw')) continue;
        v.set(s.data[i * 4], s.data[i * 4 + 1], s.data[i * 4 + 2]).applyMatrix4(group.matrixWorld).project(app.camera);
        const dx = (v.x + 1) / 2 * app.width - x, dy = (1 - v.y) / 2 * app.height - y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i / (N - 1); }
      }
      return best;
    }
  };
  return api;
}
