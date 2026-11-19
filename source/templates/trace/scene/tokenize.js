/*
 * Tokenize: a photo of a real removal project fills a pinned chapter. The line stands up across it and, as the page
 * scrolls, sweeps from right to left; everything it has passed is redrawn as a dot screen in the brand's blue on
 * paper: one dot, one gram. A lens follows the pointer over the dots and shows the real thing underneath.
 *
 *   createTokenize(app, line, { k, src, el, from, to })
 *   k: the sweep's shape index · el: the pinned block ([data-tok], holding [data-tok-stage], the copy and the counter)
 *   from/to: line.x at the start and the end of the sweep (the same numbers as the scroll keys), for the counter
 *
 * The boundary is the line itself: every frame its points are projected to the screen and binned by row, so the dots
 * begin exactly where the light is, whatever the line's tilt, scale or sway.
 */
import * as THREE from 'three';

const ROWS = 512;
const VERT = /* glsl */`
  uniform vec4 uRect; uniform vec2 uRes;
  void main() {
    vec2 p = uRect.xy + (position.xy * .5 + .5) * uRect.zw;     // drawing-buffer px, y up
    gl_Position = vec4(p / uRes * 2. - 1., 0., 1.);
  }`;
const FRAG = /* glsl */`
  uniform sampler2D uImg, uBound;
  uniform vec4 uRect; uniform vec2 uRes, uImgSize, uPtr;
  uniform float uDpr, uOn, uLens, uLensOn, uCell;
  uniform vec3 uPaper, uBlue, uHot, uInk;
  vec3 lin(vec3 c) { return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c)); }   // the photo's sRGB, decoded here (three r149 has no colorSpace)
  vec2 cover(vec2 l) {
    float ra = uRect.z / uRect.w, ia = uImgSize.x / uImgSize.y;
    vec2 s = ra > ia ? vec2(1., ia / ra) : vec2(ra / ia, 1.);
    return (l - .5) * s + .5;
  }
  float luma(vec3 c) { return dot(pow(max(c, 0.), vec3(1. / 2.2)), vec3(.299, .587, .114)); }
  void main() {
    vec2 p = gl_FragCoord.xy, l = (p - uRect.xy) / uRect.zw;
    float bx = mix(uRect.x + uRect.z + 600. * uDpr, texture2D(uBound, vec2(clamp(l.y, 0., 1.), .5)).r, uOn);

    // the world: the photo, quieter towards the copy on the left and under the header
    vec3 photo = lin(texture2D(uImg, cover(l)).rgb);
    float shade = .8 * smoothstep(.66, .04, l.x) + .35 * smoothstep(uRes.y - 220. * uDpr, uRes.y, p.y);
    vec3 world = mix(photo, uInk, clamp(shade, 0., .82));

    // on-chain: a dot screen, one dot per cell, its size from the photo's darkness under the cell's centre;
    // the dots grow in just behind the line, like ink settling
    float cell = uCell * uDpr;
    vec2 c = (floor((p - uRect.xy) / cell) + .5) * cell + uRect.xy;
    float dark = clamp((1. - luma(lin(texture2D(uImg, cover((c - uRect.xy) / uRect.zw)).rgb)) - .1) * 1.45, 0., 1.);
    float grow = smoothstep(0., 110. * uDpr, c.x - bx);
    float r = cell * .54 * (.14 + .86 * sqrt(dark)) * grow;
    float dotA = smoothstep(r + .8 * uDpr, r - .8 * uDpr, length(p - c));
    vec3 chain = mix(uPaper, mix(uHot, uBlue, grow), dotA);

    vec3 col = mix(world, chain, smoothstep(bx - .75 * uDpr, bx + .75 * uDpr, p.x));

    // the lens: the real photo, a touch magnified, inside a thin blue ring (only over the dots)
    float R = uLens * uDpr, ld = length(p - uPtr);
    float on = uLensOn * smoothstep(bx + R * .4, bx + R * 1.2, uPtr.x);
    if (on > .001) {
      vec2 lp = (uPtr - uRect.xy) / uRect.zw;
      vec3 seen = lin(texture2D(uImg, cover(lp + (l - lp) / 1.12)).rgb);
      col *= 1. - .16 * on * smoothstep(R + 18. * uDpr, R, ld) * step(R, ld);   // a soft shadow round the rim
      col = mix(col, seen, on * smoothstep(R + .8 * uDpr, R - .8 * uDpr, ld));
      col = mix(col, uBlue, on * smoothstep(1.6 * uDpr, .4 * uDpr, abs(ld - R)));
    }
    gl_FragColor = vec4(col, 1.);
  }`;

export async function createTokenize(app, line, o) {
  const P = app.params, el = o.el, stage = el && el.querySelector('[data-tok-stage]');
  if (!stage) return null;
  const img = await new THREE.TextureLoader().loadAsync(o.src);
  img.minFilter = THREE.LinearMipmapLinearFilter; img.anisotropy = 4;
  const bound = new Float32Array(ROWS * 4);
  const btex = new THREE.DataTexture(bound, ROWS, 1, THREE.RGBAFormat, THREE.FloatType);
  btex.minFilter = btex.magFilter = THREE.NearestFilter; btex.needsUpdate = true;
  const u = {
    uImg: { value: img }, uBound: { value: btex }, uRect: { value: new THREE.Vector4() }, uRes: { value: new THREE.Vector2(1, 1) },
    uImgSize: { value: new THREE.Vector2(img.image.width, img.image.height) }, uPtr: { value: new THREE.Vector2(-1e4, -1e4) },
    uDpr: { value: 1 }, uOn: { value: 0 }, uLens: { value: 112 }, uLensOn: { value: 0 }, uCell: { value: 9 },
    uPaper: { value: new THREE.Color(o.paper || '#f4f6fb') }, uBlue: { value: new THREE.Color(o.blue || '#0657ff') }, uHot: { value: new THREE.Color('#5d9bff') }, uInk: { value: new THREE.Color(o.ink || '#0b1533') }
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, depthWrite: false, depthTest: false }));
  mesh.renderOrder = 0.3;      // over the dot field, under the line
  mesh.frustumCulled = false; mesh.visible = false;
  app.scene.add(mesh);

  // the copy and the counter follow the sweep
  const steps = [...el.querySelectorAll('[data-tok-step]')], num = el.querySelector('[data-tok-n]');
  const fmt = n => Math.round(n).toLocaleString('en-US');
  let shownStep = -1, shownN = -1, lensK = 0;
  const v = new THREE.Vector3(), rows = new Float32Array(ROWS), hit = new Uint8Array(ROWS);

  app.add((t, dt) => {
    const r = stage.getBoundingClientRect(), H = app.height;
    const live = r.bottom > 0 && r.top < H && r.width > 2;
    mesh.visible = live;
    if (!live) return;
    const dpr = app.renderer.getPixelRatio();
    u.uDpr.value = dpr; u.uRes.value.set(app.width * dpr, H * dpr);
    u.uRect.value.set(r.left * dpr, (H - r.bottom) * dpr, r.width * dpr, r.height * dpr);
    u.uCell.value = app.narrow ? 7 : 9;
    u.uLens.value = app.narrow ? 80 : 112;

    // where the line is, row by row (only once it has become the sweep)
    const ds = Math.abs(P.get('line.shape') - o.k), on = ds > 0.06 ? 0 : ds < 0.005 ? 1 : 1 - (ds - 0.005) / 0.055;   // only once the line has (nearly) become the sweep
    u.uOn.value = on;
    if (on > 0) {
      line.group.updateMatrixWorld();
      rows.fill(0); hit.fill(0);
      const d = line.shapes[o.k].data, N = line.N;
      for (let i = 0; i < N; i += 2) {
        if (d[i * 4 + 3] <= 0) continue;
        v.set(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]).applyMatrix4(line.group.matrixWorld).project(app.camera);
        const sx = (v.x + 1) / 2 * app.width, sy = (1 - v.y) / 2 * H;
        const row = Math.floor((1 - (sy - r.top) / r.height) * ROWS);   // y up, like gl_FragCoord
        if (row < 0 || row >= ROWS) continue;
        rows[row] += sx; hit[row]++;
      }
      // average each row, then fill the gaps between rows and run the ends out flat
      let last = -1;
      for (let i = 0; i < ROWS; i++) {
        if (!hit[i]) continue;
        rows[i] /= hit[i];
        if (last >= 0 && i - last > 1) for (let j = last + 1; j < i; j++) rows[j] = rows[last] + (rows[i] - rows[last]) * (j - last) / (i - last);
        else if (last < 0) for (let j = 0; j < i; j++) rows[j] = rows[i];
        last = i;
      }
      if (last < 0) rows.fill(r.right + 600);
      else for (let j = last + 1; j < ROWS; j++) rows[j] = rows[last];
      for (let i = 0; i < ROWS; i++) bound[i * 4] = rows[i] * dpr;
      btex.needsUpdate = true;
    }

    // the lens follows a fine pointer over the stage
    const I = app.input;
    const over = I.fine && I.moved && I.x > r.left && I.x < r.right && I.y > r.top && I.y < r.bottom && !(document.elementFromPoint(I.x, I.y) || document.body).closest('a,button,.tok-copy,.tok-count,header');
    lensK += ((over && !app.reduced ? 1 : 0) - lensK) * Math.min(1, dt * 8);
    u.uLensOn.value = lensK * on;
    u.uPtr.value.set(I.x * dpr, (H - I.y) * dpr);

    // progress through the sweep: which step is lit, how many grams are on-chain
    const x = P.get('line.x'), from = app.narrow ? o.nFrom ?? o.from : o.from, to = app.narrow ? o.nTo ?? o.to : o.to;
    const p = on > 0.99 ? Math.max(0, Math.min(1, (from - x) / (from - to))) : 0;
    const step = Math.min(steps.length - 1, Math.floor(p * steps.length * 0.999 + 0.0001));
    if (step !== shownStep) { steps.forEach((s, i) => s.classList.toggle('is-on', i === step)); el.dataset.step = step; shownStep = step; }
    const n = p > 0.995 ? 1e6 : Math.floor(p * 1e6 / 37) * 37;
    if (num && n !== shownN) { num.textContent = fmt(n); shownN = n; el.classList.toggle('is-done', n >= 1e6); }
  }, 11);
  return { mesh };
}
