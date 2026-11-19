# Runtime — the shared WebGL toolkit

ES modules, no build step. Three.js r149 (`vendor/three.module.js`, MIT) and selected addons (`vendor/addons/`).
Every template and every site uses this; the Kage engine (`engine/`) is separate and unchanged.

Pages load it with an import map (the builder writes it):
```html
<script type="importmap">{ "imports": { "three": "./runtime/vendor/three.module.js",
  "three/addons/": "./runtime/vendor/addons/", "@runtime/": "./runtime/" } }</script>
```
From template code (`app/*.js`), import with relative paths: `import { createApp } from '../runtime/core/app.js'`.

## Mental model
1. **The app** owns the renderer, the loop, sizing, quality and the post look (`core/app.js`).
2. **Params** hold every animatable value by name (`'cup.lift'`, `'camera.fov'`, `'post.bloom'`). Scenes *read*
   params every frame; choreography, sequences, interactions and editors *write targets*; the registry eases
   the values, so all motion is smooth and anything can drive anything (`core/params.js`).
3. **Choreography** places keyframes of params on the page (scroll) or on a clock (time) (`core/choreo.js`).
4. **Scenes** are plain three.js code that reads params (`app.add((t, dt) => …)`).
5. **The DOM layer** is real HTML (SEO, accessibility) with effects driven by attributes (`dom/text.js`, `dom/ui.js`).

## API
### core/app.js — `createApp(opts)`
`opts`: `canvas` (selector/element), `post` (`false` or `{ preset, …look }`), `clear` ('#hex'), `fov`, `near`, `far`,
`shadows`, `transparent`, `quality` ('auto'|'high'|'low'), `id` (audio memory key), `onProgress(p)`.
Returns `app` with: `gl` (false without WebGL), `renderer`, `scene`, `camera`, `post`, `params`, `scroll`, `input`,
`audio`, `quality`, `narrow` (≤ 820 px), `reduced`, `time`, `dt`, `width`, `height`, `dpr`, `facts`.
- `app.add(fn(t, dt, app), order?)` per-frame updater (order: lower first; contact shadows run at 1000).
- `app.after(fn)` after render · `app.onResize(fn(w, h))` · `app.onMeasure(fn)` · `app.measure()`.
- `await app.load([promises | fns], weights?)` real loader progress · `app.track(name, weight)` → `report(0..1)` for
  finer progress inside a long step (e.g. pass it to `texture(kind, { onProgress })`) · `await app.idle()` yield inside heavy work.
- `app.start()` · `app.render` (override for custom multi-pass rendering) · `app.sceneB/cameraB` (second scene for
  `post.transition`).
- URL flags: `?q=low|high`, `?dpr=`, `?nodyn`, `?reduced`, `?nogl`, `?t=12` (frozen time for captures), `?capture`.
- QA hook `window.__studio`: `ready`, `settle(y)` (jump + settle all eased values + render), `params()`, `facts()`,
  `choreo()` (key scroll positions), `info()` (draw calls, triangles, textures, dpr, quality).
- `app.facts = { genre, signature, … }` — what the experience claims (QA reads it).

### core/params.js
`define(name, value, { min, max, step, rate, label, group })` (value: number, number array, or '#hex' → [r,g,b]),
`defineAll({ name: value | [value, opts] })`, `get`, `set(name, v, snap?)`, `setAll`, `setRate`, `reset`, `snap`,
`list()` (for editors/QA), `hold(name, true|false)` + `held(name)` (a held param is skipped by scroll choreography:
use it when a visitor's choice or an editor slider must win over the keys). `rate` = ease speed per second
(default 3.2; 0 = instant).
Also exports `ease` (linear, in/out Quad/Cubic/Quart/Expo, outBack, inOutSine, glide, smooth), `easeFn`, `clamp`, `lerp`, `smoothstep`.

### core/choreo.js
- `createChoreo(app, keys)` — scroll keyframes: `{ at: '#section' | 0..1, offset?, shift?, set: { param: value }, ease?, hold?, reset? }`.
  Forward-filled (a param keeps its last value), `hold` pauses before moving, `ease` shapes the way in.
  Methods: `at(y)`, `index(y)`, `positions()`, `measure()`, `enabled`.
- `createSequence(app, keys, { ease, snap, instant })` — time keyframes (`at` in seconds): `await seq.play()`, `stop()`.
  While playing it owns the params it names (scroll choreography waits).

### core/post.js — looks
Presets: `cinematic` (Kage), `product` (true colour), `film`, `dream`, `editorial` (light pages), `dither`, `halftone`, `none`.
Static options (`createApp({ post: {...} })` or `app.post.set({...})`): `tonemap` (aces|neutral|filmic|reinhard|linear),
`stylize` (none|dither|halftone|posterize), `levels`, `cell`, `ink`, `paper`, `vignetteColor`, `fadeColor`,
`raysColor`, `transitionType` (fade|dissolve|wipe|radial), `transitionDir`, `transitionGlow`.
Live params (animatable): `post.exposure, bloom, threshold, knee, rays, raysX, raysY, raysDecay, raysDensity, ca,
vignette, grain, contrast, saturation, temperature, tint, lift, gamma, gain, blur, tilt, focusY, focusRange,
transition, fade, styleMix, pixel`.
Transitions between two scenes: set `app.sceneB`/`app.cameraB`, animate `post.transition` 0→1, then swap.
God rays: `post.rays` > 0 with `post.raysX/Y` = light position in screen UV.

### core/scroll.js — `app.scroll`
`y, max, progress, velocity, dir`, `track(el)` → `{ progress, pinned, visible }` (live), `to(target, { duration, offset })`.
Native scrolling; in-page `#links` scroll smoothly. Use CSS `position: sticky` for pinned sections.

### core/input.js — `app.input`
`x, y, nx, ny, vx, vy, speed, down, fine`; `spin(obj, { axis, speed, inertia, tilt, bounds })` drag-to-rotate with
inertia; `hover(targets, { enter, leave, move, click, cursor })` raycast picking; `gesture({ el, shape: 'circle' |
templates, onStart, onStroke(points), onResult(result, points) })` — stroke recognition (`circle()` for drawn zeros and
rings; `dollar()` $1 recogniser for any template stroke).

### core/audio.js — `app.audio` (sound needs no files)
`enable()` (from a click), `disable`, `toggle`, `on`, `onChange(fn)`, `ui('tick'|'click'|'whoosh'|'chime'|'thud')`,
`pad({ notes, level, bright })` evolving ambient chord, `noise({ color: 'wind'|'rain'|'room', level })`,
`note(midi, { wave: saw|square|triangle|sine|fm, dur, vel, cutoff, res, attack, release, when })`,
`drum('kick'|'snare'|'hat'|'clap'|'tom', { when, vel, open })`, `sequencer({ bpm, steps, swing, onStep(step, time) })`,
`load(url)`, `play(buffer, { loop, level, rate })`, `level()` (0..1 loudness for reactive visuals), `waveform()`
(time-domain samples of the master bus for scopes and meters; `null` while sound is off).

### dom/text.js — `initText(app)` wires attributes
`data-split="chars|words"`, `data-reveal="rise|fade|blur|scale|slide|clip|scramble|type"` (+ `data-delay`,
`data-stagger`, `data-reveal-now`), `data-scrub` (words light up with scroll), `data-marquee="40"`,
`data-count="37.9"` (+ `data-decimals`, `data-prefix`, `data-suffix`). JS: `split`, `scramble`, `typewrite`, `countUp`.

### dom/ui.js
`loader(app, { el, min, exit })` → `{ done() }` (real progress in `--p` and `[data-loader-pct]`), `cursor(app)`
(`[data-cursor="Label"]`, `[data-magnetic]`), `soundToggle(app, el)`, `autoHide(app, el)`, `progressBar(app, el)`,
`sectionState(app, '[data-section]')` (html[data-section] = the section in view).
`dom/fx.css` holds the mechanics (split masks, reveals, marquee, cursor, loader fade, sound bars, reduced motion).

### gfx/textures.js — `await texture(kind, { size, colors, seed, scale, repeat, normalStrength })`
Kinds: `cork, wood, paper, mat` (cutting mat with grid + numbers), `concrete, brushed, fabric, terrazzo, speckle, grain`.
Returns `{ map, normal, rough, height, canvas }` (tileable). Options also: `planks` (wood), `cells`, `unit`, `lineColor`
(mat), `onProgress(p)`. Also `normalFromHeight(h, size, strength)`.

### gfx/studio.js
`studio(app, { env: 'softbox'|'room'|'sky'|{hdr}|{type:'softbox', panels}, background, key, fill, rim, ambient, contact })`
→ `{ lights, contact, envMap, applyEnvIntensity(v) }`; `contactShadow(app, { size, y, opacity, blur, darkness, height,
resolution, auto })` (depth-rendered each frame at order 1000; transparent meshes are skipped unless `userData.castContact`);
`softboxScene()`, `skyScene()` for custom PMREM environments.

### gfx/particles.js
`morphPoints(app, { id, count, shapes: [..≤4], size, color, color2, opacity, spread, push, additive })` with params
`<id>.morph` (0..3), `<id>.spread`, `<id>.opacity`, `<id>.size`; samplers `sampleText`, `sampleImage`, `sampleMesh`,
`shapes.sphere|ring|cloud|plane|spiral`. `drift(app, { kind: petals|leaves|snow|dust|embers, count, area, color,
wind, fall })` with params `<id>.amount`, `<id>.wind`, `<id>.opacity`.

### gfx/matter.js — GPU particles (a real simulation)
`createMatter(app, { size: 256 (→ 65 536; 128 on the low tier), palette: [lit, lit2, shadow], flow, spring, drag,
pointSize, maxSize, dof, focus, settleSteps, startRadius })` → `{ points, setShape(pts, { tint, burst, center, jitter,
light }), setPalette(cols, k), warm(steps), readPositions(), targets(), settledness(), simTime, running }`.
Positions and velocities in RGBA32F targets; springs to per-particle targets, curl flow, wander, a pointer force
around the cursor's ray, one-shot bursts, drag; one draw call with depth of field (bokeh discs) and size variety.
The target's fourth channel is light (0 shadow, 1 lit, up to 1.6 highlight). Params `matter.flow · spring · drag ·
size · opacity · focus · dof · pointer · hot · flowScale · wander`. Shapes: `sampleMeshLit(P, I, n, { rot, size,
center, light, edges, crease })` (baked light + crease lines from an EMB1 mesh), `sampleMesh`, `sampleText`,
`nebula`, `fitPoints`, `loadEMB`. Needs WebGL2 float render targets.

### gfx/glass.js — refractive glass with media
`createGlass(app, { layer: 3, scale: 0.5, refract, dispersion, liquid, rim, behindLayers, mediaGain })` →
`{ panel({ width, height, depth, radius, frames, period, fade, mediaK, mediaGain, tint, rimColor }), preload(urls) }`;
a panel → `{ mesh, show(k), setFrames(urls), swap(urls), uniforms }`. The world is drawn once without the glass into
a half-size target; each panel refracts it along its normal with a liquid flow (stirred by the pointer) and RGB
dispersion, adds a thin-film rim; frames play on the front face through the liquid and dissolve along the flow.
Params `glass.refract · glass.dispersion · glass.liquid · glass.rim`.

## Rules
- Scenes read params; nothing animates by writing positions from scroll handlers directly.
- Every heavy step awaits `app.idle()` so the loader stays alive; report progress with `app.load`.
- Respect `app.reduced` (no autoplaying motion beyond gentle fades), `app.quality` ('low' = fewer particles, smaller
  textures, no MSAA), and `app.gl === false` (the page must still read well).
- Sound starts only from a visitor's click (`app.audio.enable()` inside a click handler).
