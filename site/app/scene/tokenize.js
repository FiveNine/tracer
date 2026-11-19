/*
 * Tokenize: a photo of a real removal project fills a pinned chapter. A line of light of its own stands across it and,
 * as the page scrolls, sweeps from right to left; everything it has passed is redrawn as a dot screen in the brand's
 * blue on paper: one dot, one gram. A lens follows the pointer over the dots and shows the real thing underneath.
 *
 *   createTokenize(app, { src, el, from, to, nFrom, nTo })
 *   el: the pinned block ([data-tok], holding [data-tok-stage], the copy and the counter)
 *   from/to: where the line stands at the start and the end of the sweep, in half-view units (-1..1); nFrom/nTo on phones
 *
 * The line is drawn by the same shader as the dots, so it begins exactly where they do and never leaves its chapter.
 */
import * as THREE from 'three';

const VERT = /* glsl */`
  uniform vec4 uRect; uniform vec2 uRes;
  void main() {
    vec2 p = uRect.xy + (position.xy * .5 + .5) * uRect.zw;     // drawing-buffer px, y up
    gl_Position = vec4(p / uRes * 2. - 1., 0., 1.);
  }`;
const FRAG = /* glsl */`
  uniform sampler2D uImg;
  uniform vec4 uRect; uniform vec2 uRes, uImgSize, uPtr;
  uniform float uDpr, uLens, uLensOn, uCell, uX, uTime, uSway;
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
    // the line: where it stands (uX, px), with a slow sway down its length
    float yy = (p.y - uRect.y) / uRect.w;
    float bx = uX + uSway * (sin(yy * 4.2 + 1.3 + uTime * .35) * .7 + sin(yy * 9.7 - uTime * .22) * .3);

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
    // the line itself: a crisp white core in a soft glow, a signal running down it, feathered at the chapter's edges
    float dl = abs(p.x - bx), ends = smoothstep(0., 40. * uDpr, p.y - uRect.y) * smoothstep(0., 40. * uDpr, uRect.y + uRect.w - p.y);
    float sig = exp(-pow(fract(yy * .8 + uTime * .12) - .5, 2.) * 60.);
    float core = smoothstep(1.7 * uDpr, .5 * uDpr, dl), glow = exp(-dl / (16. * uDpr)) * (.3 + .35 * sig);
    col = mix(col, vec3(1.), clamp(core + glow, 0., 1.) * ends);
    gl_FragColor = vec4(col, 1.);
  }`;

export async function createTokenize(app, o) {
  const P = app.params, el = o.el, stage = el && el.querySelector('[data-tok-stage]');
  if (!stage) return null;
  const img = await new THREE.TextureLoader().loadAsync(o.src);
  img.minFilter = THREE.LinearMipmapLinearFilter; img.anisotropy = 4;
  const u = {
    uImg: { value: img }, uRect: { value: new THREE.Vector4() }, uRes: { value: new THREE.Vector2(1, 1) },
    uImgSize: { value: new THREE.Vector2(img.image.width, img.image.height) }, uPtr: { value: new THREE.Vector2(-1e4, -1e4) },
    uDpr: { value: 1 }, uX: { value: 0 }, uTime: { value: 0 }, uSway: { value: 30 }, uLens: { value: 112 }, uLensOn: { value: 0 }, uCell: { value: 9 },
    uPaper: { value: new THREE.Color(o.paper || '#f4f6fb') }, uBlue: { value: new THREE.Color(o.blue || '#0657ff') }, uHot: { value: new THREE.Color('#5d9bff') }, uInk: { value: new THREE.Color(o.ink || '#0b1533') }
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, depthWrite: false, depthTest: false }));
  mesh.renderOrder = 0.3;      // over the dot field
  mesh.frustumCulled = false; mesh.visible = false;
  app.scene.add(mesh);

  // the copy and the counter follow the sweep
  const steps = [...el.querySelectorAll('[data-tok-step]')], num = el.querySelector('[data-tok-n]');
  const fmt = n => Math.round(n).toLocaleString('en-US');
  let shownStep = -1, shownN = -1, lensK = 0;
  const sec = el.closest('section') || el;
  let p = 0;

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

    // how far through the pinned chapter the page is: the sweep runs over its first 85%
    const sr = sec.getBoundingClientRect(), span = Math.max(1, sr.height - H);
    const want = Math.max(0, Math.min(1, -sr.top / span / 0.85));
    p = app.reduced ? want : p + (want - p) * Math.min(1, dt * 6);
    const from = app.narrow ? o.nFrom ?? o.from : o.from, to = app.narrow ? o.nTo ?? o.to : o.to;
    const xn = from + (to - from) * p;
    u.uX.value = (r.left + (xn + 1) / 2 * r.width) * dpr;
    u.uSway.value = (app.narrow ? 0.03 : 0.022) * r.height * dpr;
    u.uTime.value = app.reduced ? 0 : t;

    // the lens follows a fine pointer over the stage
    const I = app.input;
    const over = I.fine && I.moved && I.x > r.left && I.x < r.right && I.y > r.top && I.y < r.bottom && !(document.elementFromPoint(I.x, I.y) || document.body).closest('a,button,.tok-copy,.tok-count,header');
    lensK += ((over && !app.reduced ? 1 : 0) - lensK) * Math.min(1, dt * 8);
    u.uLensOn.value = lensK;
    u.uPtr.value.set(I.x * dpr, (H - I.y) * dpr);

    // progress through the sweep: which step is lit, how many grams are on-chain
    const step = Math.min(steps.length - 1, Math.floor(p * steps.length * 0.999 + 0.0001));
    if (step !== shownStep) { steps.forEach((s, i) => s.classList.toggle('is-on', i === step)); el.dataset.step = step; shownStep = step; }
    const n = p > 0.995 ? 1e6 : Math.floor(p * 1e6 / 37) * 37;
    if (num && n !== shownN) { num.textContent = fmt(n); shownN = n; el.classList.toggle('is-done', n >= 1e6); }
  }, 11);
  return { mesh };
}
