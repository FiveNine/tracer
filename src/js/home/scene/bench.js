/*
 * The bench: one basalt core, and the life of one tonne of removal told along a straight line, left to right:
 *   the core (x 0) → the cut → the slice travels to its buyer (x≈6, the ledger behind it) → the Rabbit (x≈9.6).
 * The archive trays sit behind the bench and only show when the story zooms out from one tonne to all of them.
 *
 * Rule: objects move only when something happens to them in the story; otherwise only the camera moves.
 *
 * Params
 *   laser.on      the laser is on only while the protocol acts on the stone (measure, engrave, cut)
 *   laser.pos     0..1 along the core from its face end (0) to its far end (1): the measuring pass runs 1 → 0
 *   laser.cut     0..1 the laser leaves the face and sits where the cut will be (cut.len)
 *   engrave       0..1 the mark is engraved into the face (the endorsement)
 *   cut.len       the slice being cut (world units; the whole core is one tonne)
 *   cut.open      0..1 the slice is cut off and travels along the bench to its buyer · slice.turn 0..1 it shows its mark
 *   ledger.mix    0..1 the slice's grains become its records on the ledger · ledger.alpha the ledger's presence
 *   slice.rabbit  0..1 the slice is lowered into the Rabbit · rabbit.seal 0..1 the lid closes, for good
 *   archive.show  0..1 the other tonnes (the archive) come into view as the story zooms out
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bakeStone } from './stone.js';

export const L = 4.4, R = 0.55;

export async function createBench(app, o) {
  const P = app.params, scene = app.scene, X = o.experience || {};
  P.defineAll({
    'laser.on': [1, { rate: 3 }], 'laser.pos': [0, { rate: 3 }], 'laser.cut': [0, { rate: 3 }], 'engrave': [0, { rate: 2 }],
    'cut.len': [0.12 * L, { rate: 4 }], 'cut.open': [0, { rate: 2 }], 'slice.turn': [0, { rate: 2 }],
    'ledger.mix': [0, { rate: 1.6 }], 'ledger.alpha': [1, { rate: 2 }], 'slice.rabbit': [0, { rate: 2.2 }], 'rabbit.seal': [0, { rate: 2.2 }],
    'archive.show': [0, { rate: 1.6 }]
  });
  const colors = Object.assign({ rock: '#6a6862', rock2: '#3a3935', fleck: '#c9c5ba', fleck2: '#56604a', vein: '#e4e4df' }, X.stone || {});
  const stone = bakeStone(app.renderer, Object.assign({ size: app.quality === 'low' ? 1024 : 2048, len: L, radius: R, seed: 4.1, veins: 0.42, normal: 3 }, colors));
  await app.idle();

  const matOf = (t, face) => { const m = new THREE.MeshPhysicalMaterial({
    map: t.map, normalMap: t.normal, roughnessMap: t.rough, roughness: 1, normalScale: new THREE.Vector2(0.9, 0.9),
    clearcoat: face ? 0.9 : 0.12, clearcoatRoughness: face ? 0.12 : 0.5, envMapIntensity: face ? 0.9 : 0.6 }); m.userData.envFixed = true; return m; };
  const sideMat = matOf(stone.side, false), faceMat = matOf(stone.face, true);
  const cyl = new THREE.CylinderGeometry(R, R, 1, 160, 1);
  // each part shows its own stretch of the stone: its side uvs are re-windowed (v runs along the core), never stretched
  const SIDE_V = 161 * 2, uv0 = cyl.attributes.uv.array.slice(0, SIDE_V * 2);
  const setWindow = (g, a, b) => { const uv = g.attributes.uv; for (let i = 0; i < SIDE_V; i++) uv.array[i * 2 + 1] = a + uv0[i * 2 + 1] * (b - a); uv.needsUpdate = true; };

  // ---- the core: lies still on the bench for the whole story ----
  const coreRot = X.coreRot ?? -0.3;
  const spec = new THREE.Group(); spec.rotation.y = coreRot; scene.add(spec);
  const mainGeo = cyl.clone(), sliceGeo = cyl.clone();
  const main = new THREE.Mesh(mainGeo, [sideMat, faceMat, faceMat]); main.rotation.z = -Math.PI / 2; main.position.y = R; spec.add(main);
  const slice = new THREE.Mesh(sliceGeo, [sideMat, faceMat, faceMat]); slice.rotation.z = -Math.PI / 2;
  const sliceG = new THREE.Group(); sliceG.add(slice); scene.add(sliceG);

  // ---- the engraving on the face: the mark in blue enamel, burnt in by the laser (the endorsement) ----
  const mk = o.markSvg;
  const mask = document.createElement('canvas'); mask.width = mask.height = 1024;
  { const x = mask.getContext('2d'), s = 1024 * 0.5 / mk.vb[3]; x.translate(512 - mk.vb[2] * s / 2, 512 - mk.vb[3] * s / 2); x.scale(s, s); x.fillStyle = '#fff'; x.fill(new Path2D(mk.d), 'evenodd'); }
  const inlay = new THREE.Mesh(new THREE.CircleGeometry(R * 0.995, 96), new THREE.ShaderMaterial({
    transparent: false, polygonOffset: true, polygonOffsetFactor: -2,   // opaque, so the Rabbit's glass (which refracts opaque things) shows it
    uniforms: { uMask: { value: new THREE.CanvasTexture(mask) }, uReveal: { value: 0 }, uBlue: { value: new THREE.Color(o.blue || '#0657ff') }, uRot: { value: X.inlayRot ?? 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: /* glsl */`
      uniform sampler2D uMask; uniform float uReveal, uRot; uniform vec3 uBlue; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 uv = vUv - .5; float c = cos(uRot), s = sin(uRot); uv = mat2(c, -s, s, c) * uv + .5;
        float m = texture2D(uMask, uv).r;
        float sweep = uReveal * 1.3 - .15;                         // the laser's line crosses the face
        float done = smoothstep(sweep + .01, sweep - .01, uv.x);
        float edge = exp(-abs(uv.x - sweep) * 90.) * step(.001, uReveal) * step(uReveal, .999);
        vec3 enamel = uBlue * (.8 + .12 * h(floor(uv * 260.))) + vec3(.06, .08, .16) * smoothstep(.3, .9, uv.y);
        vec3 col = mix(enamel, vec3(.85, .93, 1.) * 2.5, clamp(edge * m * 1.4, 0., 1.));
        float a = m * done + edge * (m * .9 + .15); if (a < .5) discard;
        gl_FragColor = vec4(col, 1.);
      }`
  }));
  inlay.rotation.x = -Math.PI / 2; inlay.position.y = 0.5 + 0.002; inlay.userData.noShadow = true; slice.add(inlay);

  // ---- the laser: the protocol's hand. A ring of light, a soft collar, and the light it throws on the stone ----
  const laser = new THREE.Group(); laser.position.y = R; spec.add(laser);
  const hot = new THREE.Color(o.laser || '#4d86ff').multiplyScalar(3.2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.012, 0.006, 8, 160), new THREE.MeshBasicMaterial({ color: hot, toneMapped: false }));
  ring.rotation.y = Math.PI / 2; laser.add(ring);
  const collarMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uColor: { value: new THREE.Color(o.laser || '#4d86ff') }, uOn: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uOn; varying vec2 vUv; void main(){ float d = abs(vUv.y - .5) * 2.; gl_FragColor = vec4(uColor * 1.6, exp(-d * d * 18.) * .55 * uOn); }'
  });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.22, 96, 1, true), collarMat);
  collar.rotation.z = Math.PI / 2; collar.userData.noShadow = true; laser.add(collar);
  const glow = new THREE.PointLight(o.laser || '#4d86ff', 0, 1.6, 2); laser.add(glow);

  // ---- the ledger on Base: a wall of records already there (faint), and this slice's grains becoming its own block ----
  const wall = new THREE.Object3D(); wall.position.fromArray(X.ledgerWall || [6, 0.35, -1.6]); scene.add(wall);
  const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(11);
  const GW = 5.2, GH = 2.1, GC = 130, GR = 52;
  const gridPos = new Float32Array(GC * GR * 3);
  for (let i = 0; i < GC * GR; i++) gridPos.set([((i % GC) / (GC - 1) - 0.5) * GW, ((i / GC | 0) / (GR - 1)) * GH, 0], i * 3);
  const gridG = new THREE.BufferGeometry(); gridG.setAttribute('position', new THREE.BufferAttribute(gridPos, 3));
  const grid = new THREE.Points(gridG, new THREE.PointsMaterial({ color: o.ink || '#16140f', size: 0.03, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0 }));
  wall.add(grid);
  // the slice's block sits in the middle of the wall, above where the slice stands
  const BC = 44, BR = 26, NB = BC * BR;
  const bstep = GW / (GC - 1), bx0 = -BC * bstep / 2, by0 = 0.62;
  const aStart = new Float32Array(NB * 3), aEnd = new Float32Array(NB * 3), aCol = new Float32Array(NB * 3), aD = new Float32Array(NB);
  const stoneCols = ['#2a2927', '#3a3936', '#1d1c1a', '#e4e4df', '#c9c5ba'].map(c => new THREE.Color(c));
  for (let i = 0; i < NB; i++) {
    const r = Math.sqrt(rnd()) * R * 0.97, a = rnd() * Math.PI * 2;
    aStart.set([Math.cos(a) * r, 0.5 + 0.004, Math.sin(a) * r], i * 3);              // on the slice's face (cylinder space)
    const cx = i % BC, cy = i / BC | 0;
    aEnd.set([bx0 + cx * bstep, by0 + cy * bstep, 0.002], i * 3);                     // its cell in the block (wall space)
    const c = stoneCols[rnd() < 0.18 ? 3 + (rnd() < 0.5 ? 1 : 0) : (rnd() * 3) | 0]; aCol.set([c.r, c.g, c.b], i * 3);
    aD[i] = r / R * 0.35 + rnd() * 0.25 + (cy / BR) * 0.2;
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.BufferAttribute(aEnd, 3)); bg.setAttribute('aStart', new THREE.BufferAttribute(aStart, 3));
  bg.setAttribute('aCol', new THREE.BufferAttribute(aCol, 3)); bg.setAttribute('aD', new THREE.BufferAttribute(aD, 1));
  const grainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uMix: { value: 0 }, uAlpha: { value: 1 }, uFace: { value: new THREE.Matrix4() }, uWall: { value: new THREE.Matrix4() }, uBlue: { value: new THREE.Color(o.blue || '#0657ff') }, uSize: { value: 3 } },
    vertexShader: /* glsl */`
      attribute vec3 aStart, aCol; attribute float aD;
      uniform float uMix, uSize, uAlpha; uniform mat4 uFace, uWall; uniform vec3 uBlue;
      varying vec3 vCol; varying float vA;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        float t = clamp((uMix * 1.7 - aD) / .7, 0., 1.); t = t * t * (3. - 2. * t);
        vec3 a = (uFace * vec4(aStart, 1.)).xyz, b = (uWall * vec4(position, 1.)).xyz;
        vec3 p = mix(a, b, t);
        p.y += sin(t * 3.14159) * (.5 + h(aD * 91.) * .6);
        vCol = mix(aCol, uBlue, smoothstep(.2, .9, t));
        vA = smoothstep(0., .04, uMix) * uAlpha;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_PointSize = uSize * (6. / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'varying vec3 vCol; varying float vA; void main(){ vec2 d = gl_PointCoord - .5; float r = length(d); if (r > .5) discard; gl_FragColor = vec4(vCol, vA * smoothstep(.5, .3, r)); }'
  });
  const grains = new THREE.Points(bg, grainMat); grains.frustumCulled = false; grains.userData.noShadow = true; scene.add(grains);

  // ---- the Rabbit: a glass vessel on a blue plinth at the end of the bench; what goes in is retired for good ----
  const rabbit = new THREE.Group(); rabbit.position.fromArray(X.rabbitAt || [9.6, 0, 0.9]); scene.add(rabbit);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, thickness: 0.08, roughness: 0.04, ior: 1.5, clearcoat: 1, envMapIntensity: 1.2 });
  const box = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.45, 1.2, 6, 0.08), glassMat); box.position.y = 0.16 + 0.725; box.userData.castContact = true;
  const lid = new THREE.Mesh(new RoundedBoxGeometry(1.56, 0.08, 1.26, 4, 0.03), new THREE.MeshPhysicalMaterial({ color: '#0a3fd0', roughness: 0.35, metalness: 0.2, clearcoat: 1 }));
  const plinthTex = (() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#0a3fd0'; x.fillRect(0, 0, 1024, 128); x.fillStyle = 'rgba(255,255,255,.92)'; x.font = '500 46px "IBM Plex Mono", monospace'; x.textBaseline = 'middle'; x.fillText(o.rabbitLabel || 'RABBIT #0042', 46, 66); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; })();
  const plinthMats = Array.from({ length: 6 }, (_, i) => new THREE.MeshPhysicalMaterial({ color: i === 4 ? '#ffffff' : '#0a3fd0', map: i === 4 ? plinthTex : null, roughness: 0.45, metalness: 0.1, clearcoat: 0.4, envMapIntensity: 0.5 }));
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 1.36), plinthMats); plinth.position.y = 0.08;
  const inner = new THREE.PointLight(o.laser || '#4d86ff', 0, 2.2, 2); inner.position.y = 0.9;
  rabbit.add(box, lid, plinth, inner);

  // ---- the archive: every other tonne, in trays behind the bench; blue caps are retired ----
  const tray = new THREE.Group(); scene.add(tray);
  const archSide = sideMat.clone(), archFace = faceMat.clone(), capMat = new THREE.MeshPhysicalMaterial({ color: '#0a3fd0', roughness: 0.3, clearcoat: 1 });
  const trayMat = new THREE.MeshStandardMaterial({ color: '#c4bba8', roughness: 1, envMapIntensity: 0.25 });
  [archSide, archFace, capMat, trayMat].forEach(m => { m.transparent = true; m.opacity = 0; });
  const arcGeo = cyl.clone(); setWindow(arcGeo, 0.1, 0.42);
  const segs = [], caps = [], q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2));
  const N_ROWS = 7, N_IN = 4, X0 = X.archiveX0 ?? -1.6, rs = 0.55;
  const trayBoxes = new THREE.Group(); tray.add(trayBoxes);
  for (let row = 0; row < N_ROWS; row++) {
    const z = -2.2 - row * 0.95;
    for (let i = 0; i < N_IN; i++) {
      const x0 = X0 + i * 3.0;
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.06, 0.82), trayMat); b.position.set(x0 + 1.38, 0.03, z); trayBoxes.add(b);
      let x = x0;
      while (true) {
        const len = 0.6 + rnd() * 1.4; if (x + len > x0 + 2.75) break;
        segs.push(new THREE.Matrix4().compose(new THREE.Vector3(x + len / 2, R * rs, z), q, new THREE.Vector3(rs, len, rs)));
        if (rnd() < 0.3) caps.push(new THREE.Matrix4().compose(new THREE.Vector3(x + len + 0.025, R * rs, z), q, new THREE.Vector3(rs, 1, rs)));
        x += len + 0.06;
      }
    }
  }
  const inst = new THREE.InstancedMesh(arcGeo, [archSide, archFace, archFace], segs.length); segs.forEach((m, i) => inst.setMatrixAt(i, m));
  const capI = new THREE.InstancedMesh(new THREE.CylinderGeometry(R * 1.003, R * 1.003, 0.05, 64), capMat, caps.length); caps.forEach((m, i) => capI.setMatrixAt(i, m));
  tray.add(inst, capI);

  // ---- per frame ----
  const up = new THREE.Vector3(0, 1, 0), attached = new THREE.Vector3(), atBuyer = new THREE.Vector3().fromArray(X.sliceAt || [6, R, 1.0]);
  const pos = new THREE.Vector3(), above = new THREE.Vector3(), inRabbit = new THREE.Vector3();
  let lastLen = -1;
  const ease = t => t * t * (3 - 2 * t);
  app.add(() => {
    const len = Math.max(0.03, P.get('cut.len')), mainLen = L - len;
    main.scale.y = mainLen; main.position.x = -L / 2 + mainLen / 2; slice.scale.y = len;
    if (len !== lastLen) { setWindow(mainGeo, 0, mainLen / L); setWindow(sliceGeo, mainLen / L, 1); lastLen = len; }
    // the slice: attached at the end of the core; once cut, it travels along the bench to its buyer and shows its mark
    attached.set(L / 2 - len / 2, R, 0).applyAxisAngle(up, coreRot).add(spec.position);
    const open = ease(P.get('cut.open')), turn = ease(P.get('slice.turn'));
    pos.copy(attached).lerp(atBuyer, open);
    pos.y += Math.sin(open * Math.PI) * 0.35;               // it lifts off the bench while it travels
    let ry = coreRot + turn * (-Math.PI / 2 - coreRot + (X.faceAngle ?? 0.38));
    // into the Rabbit: up, over, down
    const rb = P.get('slice.rabbit');
    if (rb > 0) {
      inRabbit.set(rabbit.position.x, 0.16 + R + 0.06, rabbit.position.z); above.set(inRabbit.x, 2.4, inRabbit.z);
      const a = ease(Math.min(1, rb / 0.6)), b = ease(Math.max(0, (rb - 0.6) / 0.4));
      pos.lerp(above, a).lerp(inRabbit, b);   // it keeps showing its mark through the glass
    }
    sliceG.position.copy(pos); sliceG.rotation.set(0, ry, 0);
    // the laser: measuring pass (pos 1 → 0) ends at the face; then it moves to the cut; it switches off once the slice is cut
    const on = P.get('laser.on') * (1 - open);
    const lx = L / 2 - P.get('laser.pos') * L;
    laser.position.x = THREE.MathUtils.lerp(lx, L / 2 - len, P.get('laser.cut'));
    ring.material.color.copy(hot).multiplyScalar(on); collarMat.uniforms.uOn.value = on; glow.intensity = on * 2.4;
    laser.visible = on > 0.01;
    inlay.material.uniforms.uReveal.value = P.get('engrave');
    // the ledger: grains leave from where the face is (frozen once they start)
    const mix = P.get('ledger.mix'), la = P.get('ledger.alpha');
    if (mix < 0.002) { slice.updateMatrixWorld(); grainMat.uniforms.uFace.value.copy(slice.matrixWorld); }
    wall.updateMatrixWorld(); grainMat.uniforms.uWall.value.copy(wall.matrixWorld);
    grainMat.uniforms.uMix.value = mix; grainMat.uniforms.uAlpha.value = la; grains.visible = mix > 0.002 && la > 0.01;
    grainMat.uniforms.uSize.value = 8 * app.renderer.getPixelRatio();
    grid.material.opacity = Math.min(1, mix * 4) * 0.5 * la; grid.visible = grid.material.opacity > 0.01;
    // the Rabbit
    const seal = ease(P.get('rabbit.seal'));
    lid.position.set(0, 0.16 + 1.45 + 0.04 + (1 - seal) * 0.55, (1 - seal) * -0.15); lid.rotation.x = (1 - seal) * -0.5;
    inner.intensity = seal * 1.6;
    // the archive
    const as = P.get('archive.show');
    tray.visible = as > 0.01;
    archSide.opacity = archFace.opacity = capMat.opacity = trayMat.opacity = as;
    archSide.depthWrite = archFace.depthWrite = capMat.depthWrite = as > 0.98;
  }, 2);

  return { spec, main, slice, sliceG, laser, inlay, rabbit, tray, wall,
    sliceCenter: () => sliceG.position.clone(),
    rabbitTop: () => rabbit.position.clone().add(new THREE.Vector3(0.75, 1.65, 0)),
    faceCenter: (out = new THREE.Vector3()) => out.set(L / 2, R, 0).applyAxisAngle(up, coreRot).add(spec.position),
    blockTop: (out = new THREE.Vector3()) => out.set(bx0 + BC * bstep, by0 + BR * bstep, 0).applyMatrix4(wall.matrixWorld) };
}
