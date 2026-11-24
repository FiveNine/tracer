/*
 * The Carrot machine: the ecosystem as one production line, in the site's own style (white parts with a fine ink edge,
 * brand blue only where it matters). Six stations on their own pads: removal projects, the Endorser, the Mint on Base,
 * the Marketplace, the Rabbit and the TRCR tower. Crates ride the belts, the stamp presses, grams flow; the section is
 * pinned and scrolling walks the camera from the whole line to each station in turn and back out.
 *
 *   createFactory(app, el)   el: [data-fx] (render.mjs factory), with data-items (the six stations) and data-model
 *
 * It draws with its own renderer into the section, and only while the section is on screen.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices as mergeVerts } from 'three/addons/utils/BufferGeometryUtils.js';

const rnd = (a => () => (a = (a * 16807) % 2147483647) / 2147483647)(11);

async function buildScene(o, anims) {
  const scene = new THREE.Scene();
  
const BLUE = '#0657ff', INK = '#0b1533', WHITE = '#ffffff', PAPER = '#eef1f8';
  // ---- building blocks: lit solids with a fine ink outline ----
  const mats = {};
  const M = (c, o = {}) => mats[c + JSON.stringify(o)] ||= new THREE.MeshStandardMaterial({ color: c, roughness: .72, metalness: 0, ...o });
  const edgeM = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: .55 });
  function part(geo, c, x = 0, y = 0, z = 0, parent = scene, edges = true, o = {}) {
    const m = new THREE.Mesh(geo, M(c, o)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m);
    if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeM));
    return m;
  }
  function rbox(w, h, d, r = .08) {   // a box with softened edges
    const g = new THREE.BoxGeometry(w, h, d, 6, 6, 6), p = g.attributes.position, v = new THREE.Vector3(), hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const c = new THREE.Vector3(Math.max(-hw, Math.min(hw, v.x)), Math.max(-hh, Math.min(hh, v.y)), Math.max(-hd, Math.min(hd, v.z))); v.sub(c); if (v.lengthSq() > 0) v.normalize().multiplyScalar(r); v.add(c); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return g;
  }
  const group = (x, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); return g; };
  // ---- ground: paper with a faint grid ----
  { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#e9edf5'; x.fillRect(0, 0, 256, 256); x.strokeStyle = 'rgba(11,21,51,.07)'; x.lineWidth = 2; for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(200, 200); t.encoding = THREE.sRGBEncoding;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ map: t, roughness: 1 })); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g); }
  // ---- the line: stations spaced along one diagonal conveyor ----
  // x runs left → right along the line; each station has its own pad
  const ST = [-17, -8.5, -1, 6.5, 14, 21];
  const pad = (x, w = 6, d = 5.4, c = WHITE) => part(rbox(w, .3, d, .12), c, x, .15, 0);
  ST.forEach((x, i) => { pad(x, i === 0 ? 7.5 : 5.6, i === 0 ? 7 : 5.2); });
  // numbered plates at the front of each pad
  const plate = (x, n) => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.fillStyle = BLUE; g.fillRect(0, 0, 128, 64); g.fillStyle = '#fff'; g.font = '600 38px JetBrains Mono'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 64, 34); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; const m = new THREE.Mesh(new THREE.PlaneGeometry(.9, .45), new THREE.MeshBasicMaterial({ map: t })); m.rotation.x = -Math.PI / 2; m.position.set(x - 2.2, .31, 2.1); scene.add(m); };
  ST.forEach((x, i) => plate(x, '0' + (i + 1)));
  // conveyor: a belt with rollers and a blue trace running down its middle
  const beltZ = 0;
  function belt(x0, x1, z = beltZ) {
    const L = x1 - x0, cx = (x0 + x1) / 2;
    part(rbox(L, .16, .9, .05), '#dfe4ef', cx, .62, z);
    for (let x = x0 + .3; x < x1; x += .6) part(new THREE.CylinderGeometry(.07, .07, .95, 10), WHITE, x, .5, z, scene, false).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) for (let x = x0 + .4; x < x1; x += 2.2) part(new THREE.BoxGeometry(.08, .5, .08), WHITE, x, .25, z + s * .4);
    const tr = new THREE.Mesh(new THREE.BoxGeometry(L, .012, .07), new THREE.MeshBasicMaterial({ color: BLUE })); tr.position.set(cx, .71, z); scene.add(tr);
  }
  belt(-13.2, -10.6); belt(-6.6, -3.2); belt(1.4, 4.4); belt(8.8, 12); belt(16.2, 19.2);
  // what travels: tonne crates, then CRRT coins
  // a tonne of removed carbon: an open white slatted crate heaped with dark granules, a "1 t CO₂" plate on its side;
  // once endorsed it carries a blue strap and a round blue seal
  const granG = new THREE.IcosahedronGeometry(.07, 0), granM = new THREE.MeshStandardMaterial({ color: '#2a2f3a', roughness: .9, flatShading: true });
  const labelTex = (txt, bg = '#ffffff', fg = '#0b1533', w = 256, h = 128, fs = 52) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = `600 ${fs}px Space Grotesk`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 3); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; };
  const tonneTex = labelTex('1 t CO₂', '#ffffff', '#0b1533', 256, 128, 50);
  const crate = (x, z = 0, sealed = false, y = .98) => {
    const g = new THREE.Group(); g.position.set(x, y - .31, z); scene.add(g);
    part(new THREE.BoxGeometry(.66, .06, .66), '#f3f5fa', 0, .03, 0, g);
    for (const [dx, dz, ry] of [[0, .3, 0], [0, -.3, 0], [.3, 0, Math.PI / 2], [-.3, 0, Math.PI / 2]])
      for (let k = 0; k < 3; k++) { const sl = part(new THREE.BoxGeometry(.66, .13, .05), '#ffffff', dx, .14 + k * .17, dz, g); sl.rotation.y = ry; }
    for (const [dx, dz] of [[.3, .3], [-.3, .3], [.3, -.3], [-.3, -.3]]) part(new THREE.BoxGeometry(.07, .58, .07), '#f3f5fa', dx, .3, dz, g, false);
    const o = new THREE.Object3D(), im = new THREE.InstancedMesh(granG, granM, 60); im.castShadow = true;
    for (let i = 0; i < 60; i++) { const r = Math.sqrt(rnd()) * .27, a = rnd() * 6.28; o.position.set(Math.cos(a) * r, .5 + (.27 - r) * .5 + rnd() * .05, Math.sin(a) * r); o.rotation.set(rnd() * 3, rnd() * 3, 0); o.scale.setScalar(.7 + rnd() * .7); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
    g.add(im);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(.42, .21), new THREE.MeshBasicMaterial({ map: tonneTex })); lab.position.set(0, .31, .33); g.add(lab);
    if (sealed) { for (const dz of [.335, -.335]) part(new THREE.BoxGeometry(.09, .6, .012), BLUE, -.12, .31, dz, g, false); part(new THREE.BoxGeometry(.09, .012, .68), BLUE, -.12, .615, 0, g, false);
      const seal = part(new THREE.CylinderGeometry(.13, .13, .03, 28), BLUE, .2, .31, .345, g, false); seal.rotation.x = Math.PI / 2; part(new THREE.TorusGeometry(.08, .012, 8, 24), '#ffffff', .2, .31, .362, g, false); }
    return g;
  };
  // CRRT: small coins, a blue disc with a white ring and CRRT on its face; they ride the belts in rows, stack on the
  // market's trays and drop one by one into the rabbit bank
  const coinTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = BLUE; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#ffffff'; x.lineWidth = 7; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.stroke();
    x.fillStyle = '#ffffff'; x.font = '700 27px Space Grotesk'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('CRRT', 64, 67);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; })();
  const coinG = new THREE.CylinderGeometry(.15, .15, .045, 32);
  const coinMats = [M('#0446d6', { roughness: .35 }), new THREE.MeshStandardMaterial({ map: coinTex, roughness: .35 }), M(BLUE, { roughness: .35 })];
  const coins = n => { const im = new THREE.InstancedMesh(coinG, coinMats, n); im.castShadow = true; scene.add(im); return im; };
  const placed = list => { const im = coins(list.length), o = new THREE.Object3D(); list.forEach(([x, y, z, rx = 0, rz = 0], i) => { o.position.set(x, y, z); o.rotation.set(rx, 0, rz); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); return im; };
  // coins riding a belt: in lanes, evenly spaced, lying flat, wrapping round at the end
  const coinFlow = (x0, L, lanes, gap, v, y = .74) => { const per = Math.floor(L / gap), n = per * lanes.length, im = coins(n), o = new THREE.Object3D();
    anims.push(t => { let k = 0; for (const z of lanes) for (let i = 0; i < per; i++) { o.position.set(x0 + ((i * gap + t * v + (z * 1.7 + 5)) % L), y, z); o.rotation.set(0, 0, 0); o.updateMatrix(); im.setMatrixAt(k++, o.matrix); } im.instanceMatrix.needsUpdate = true; }); };
  const movers = (x0, x1, n, sealed, v = .45) => { const L = x1 - x0 - .7, cs = []; for (let i = 0; i < n; i++) cs.push(crate(x0 + .35, 0, sealed));
    anims.push(t => cs.forEach((c, i) => { c.position.x = x0 + .35 + ((t * v + i * L / n) % L); })); };
  
  // 01 · removal projects: four small plots feeding one belt
  { const x0 = ST[0];
    const plot = (dx, dz, fill) => { const g = group(x0 + dx, dz); part(rbox(2.8, .22, 2.6, .08), '#e8ecf4', 0, .41, 0, g); fill(g); return g; };
    plot(-1.7, -1.7, g => { for (let i = 0; i < 7; i++) { const t = new THREE.Group(); t.position.set(-.9 + (i % 4) * .6, .52, -.6 + Math.floor(i / 4) * 1.1 + (i % 2) * .2); part(new THREE.CylinderGeometry(.05, .06, .3, 6), '#9b7b5b', 0, .15, 0, t, false); part(new THREE.ConeGeometry(.28, .8, 8), '#5f9470', 0, .65, 0, t); g.add(t); } });
    plot(1.7, -1.7, g => { part(new THREE.BoxGeometry(2.6, .05, 2.4), '#9cc3ef', 0, .54, 0, g, false); for (let i = 0; i < 5; i++) { const t = new THREE.Group(); t.position.set(-.8 + (i % 3) * .8, .55, -.5 + Math.floor(i / 3) * 1); part(new THREE.SphereGeometry(.3, 12, 10), '#4f8f74', 0, .55, 0, t); for (const a of [0, 2.1, 4.2]) part(new THREE.CylinderGeometry(.02, .02, .45, 4), '#9b7b5b', Math.cos(a) * .12, .2, Math.sin(a) * .12, t, false); g.add(t); } });
    // biochar: a white pyrolysis kiln, bulk sacks of char, and the char worked into dark soil with sprouts
    plot(-1.7, 1.7, g => {
      part(new THREE.CylinderGeometry(.42, .42, .95, 24), '#ffffff', -.7, .98, -.55, g).rotation.z = Math.PI / 2;
      for (const dx of [-1.05, -.35]) part(new THREE.TorusGeometry(.43, .035, 8, 24), '#c9d1e2', dx, .98, -.55, g, false).rotation.y = Math.PI / 2;
      part(new THREE.CylinderGeometry(.08, .08, 1.1, 12), '#ffffff', -.3, 1.6, -.75, g);
      for (let i = 0; i < 4; i++) part(new THREE.SphereGeometry(.09 + i * .045, 10, 8), '#ffffff', -.28 + i * .07, 2.25 + i * .22, -.8, g, false, { transparent: true, opacity: .75 });
      const sackT = labelTex('BIOCHAR', '#ffffff', '#0b1533', 256, 96, 40);
      for (const [dx, dz] of [[.55, -.6], [1.0, -.25]]) { const sk = part(rbox(.42, .5, .42, .1), '#ffffff', dx, .78, dz, g); for (const sx of [-.15, .15]) part(new THREE.TorusGeometry(.07, .015, 6, 12, Math.PI), BLUE, sx, .27, 0, sk, false); const l = new THREE.Mesh(new THREE.PlaneGeometry(.36, .13), new THREE.MeshBasicMaterial({ map: sackT })); l.position.set(0, 0, .215); sk.add(l); }
      for (let r = 0; r < 3; r++) { part(rbox(2.2, .1, .26, .05), '#3b3a3a', 0, .57, .35 + r * .38, g, false); for (let k = 0; k < 7; k++) { const sp = new THREE.Group(); sp.position.set(-.95 + k * .32, .62, .35 + r * .38); part(new THREE.CylinderGeometry(.012, .012, .12, 4), '#5f9470', 0, .06, 0, sp, false); part(new THREE.SphereGeometry(.05, 6, 4), '#6fae7e', 0, .13, 0, sp, false); g.add(sp); } }
    });
    // enhanced weathering: crop rows, a heap of crushed basalt, a small tractor spreading grey rock dust
    plot(1.7, 1.7, g => {
      for (let r = 0; r < 5; r++) part(rbox(2.4, .07, .2, .03), r % 2 ? '#a9c89a' : '#b9d4a8', 0, .55, -.9 + r * .42, g, false);
      for (let r = 0; r < 2; r++) part(new THREE.BoxGeometry(1.2, .015, .2), '#9aa1ad', -.55, .6, -.48 + r * .84, g, false);   // dust already spread
      const ho = new THREE.Object3D(), heap = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.09, 0), new THREE.MeshStandardMaterial({ color: '#6b7380', roughness: .9, flatShading: true }), 70); heap.castShadow = true;
      for (let i = 0; i < 70; i++) { const r = Math.sqrt(rnd()) * .45, a = rnd() * 6.28; ho.position.set(-.85 + Math.cos(a) * r, .58 + (.45 - r) * .7 + rnd() * .05, .75 + Math.sin(a) * r * .8); ho.rotation.set(rnd() * 3, rnd() * 3, 0); ho.updateMatrix(); heap.setMatrixAt(i, ho.matrix); }
      g.add(heap);
      const tr = new THREE.Group(); tr.position.set(.45, .58, -.06); g.add(tr);
      part(rbox(.7, .28, .42, .06), BLUE, 0, .3, 0, tr); part(rbox(.3, .32, .36, .05), '#ffffff', -.12, .62, 0, tr);
      for (const [wx, r] of [[-.2, .2], [.25, .14]]) for (const wz of [-.24, .24]) part(new THREE.CylinderGeometry(r, r, .1, 16), '#1f2430', wx, r, wz, tr, false).rotation.x = Math.PI / 2;
      part(rbox(.5, .22, .5, .04), '#ffffff', .62, .3, 0, tr);   // the spreader hopper
      for (let i = 0; i < 18; i++) part(new THREE.SphereGeometry(.03 + rnd() * .03, 6, 4), '#9aa1ad', .9 + rnd() * .5, .12 + rnd() * .25, (rnd() - .5) * .45, tr, false, { transparent: true, opacity: .8 });
    });
    // crates leaving the projects
    movers(-13.2, -10.6, 2, false);
  }
  // 02 · endorser: a gate with a stamp press coming down on a crate
  { const g = group(ST[1], 0);
    for (const z of [-1.1, 1.1]) part(rbox(.4, 3, .4, .06), WHITE, 0, 1.8, z, g);
    part(rbox(1.4, .5, 2.8, .08), WHITE, 0, 3.4, 0, g);
    part(new THREE.CylinderGeometry(.09, .09, .8, 12), '#c9d1e2', 0, 2.8, 0, g, false);
    const stamp = part(new THREE.CylinderGeometry(.34, .34, .3, 28), BLUE, 0, 2.28, 0, g);
    anims.push(t => { const c = (t % 2.6) / 2.6, d = c < .5 ? 0 : Math.sin((c - .5) * 2 * Math.PI); stamp.position.y = 2.28 - Math.max(0, d) * .5; });
    // a little screen on the gate: a check
    part(rbox(.06, .5, .7, .03), INK, -.72, 3.4, 0, g, false);
    crate(ST[1], 0, false, .98); movers(-6.6, -3.2, 2, true);
  }
  // 03 · mint on Base: a crate goes in, a stream of grams comes out
  { const g = group(ST[2], 0);
    part(rbox(2.6, 2, 2.4, .14), WHITE, 0, 1.3, 0, g);
    part(new THREE.CylinderGeometry(.9, .35, .8, 28, 1, true), WHITE, -.4, 2.7, 0, g);   // the hopper
    for (let i = 0; i < 3; i++) part(new THREE.CylinderGeometry(.18, .18, .1, 20), i ? '#c9d1e2' : BLUE, -1.0 + i * .5, 2.35, -.9, g, false);
    const mc = crate(ST[2] - .4, 0, true, 3.3); anims.push(t => { mc.position.y = 2.99 + Math.sin(t * 1.8) * .05; mc.rotation.y = Math.sin(t * .9) * .08; });
    part(rbox(.05, .9, 1.5, .04), INK, 1.31, 1.1, -.15, g, false);                        // a window on the side facing the line
    { const st = []; for (let s = 0; s < 3; s++) for (let k = 0; k < 5 + s; k++) st.push([ST[2] + 1.38, .42 + s * .0 + k * .05, -.55 + s * .4, 0, Math.PI / 2 * 0]); placed(st.map(([x, y, z]) => [x - .05, .62 + (y - .42), z])); }   // stacks seen through the window
    for (let i = 0; i < 4; i++) part(rbox(1.6, .06, .05, .02), '#c9d1e2', -.2, .7 + i * .22, 1.22, g, false);   // vents on the front
    { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#0657ff'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#fff'; x.font = '600 54px Space Grotesk'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('CRRT', 128, 70);
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .65), new THREE.MeshBasicMaterial({ map: t })); m.position.set(ST[2] - .2, 1.85, 1.215); scene.add(m); }
    // the tonne leaves as CRRT: three lanes of coins on the next belt
    coinFlow(1.5, 3, [-.25, 0, .25], .38, .45);

  }
  // 04 · marketplace: grams in trays on a counter, priced, paid in stablecoins
  { const g = group(ST[3], 0);
    part(rbox(3, 1, 1.6, .1), WHITE, 0, .8, -.2, g);
    for (const x of [-1.35, 1.35]) part(rbox(.14, 2.4, .14, .04), WHITE, x, 1.5, -.85, g);
    for (let i = 0; i < 6; i++) part(rbox(.5, .08, 1.9, .03), i % 2 ? WHITE : BLUE, -1.25 + i * .5, 2.8, -.2, g).rotation.x = .28;
    // trays of CRRT, in stacks, each with its price tag
    { const st = []; for (let k = 0; k < 3; k++) { part(rbox(.8, .1, .6, .04), '#dfe4ef', -.9 + k * .9, 1.36, -.3, g);
        for (const [dx, dz, h] of [[-.17, -.08, 4 + k], [.17, -.1, 2 + k], [0, .14, 3]]) for (let c = 0; c < h; c++) st.push([ST[3] - .9 + k * .9 + dx, 1.44 + c * .048, -.3 + dz]);
        const tag = part(rbox(.3, .2, .02, .01), '#ffffff', -.9 + k * .9, 1.62, .02, g); tag.rotation.x = -.35; part(new THREE.BoxGeometry(.16, .005, .004), BLUE, 0, .03, .012, tag, false); }
      placed(st); }
    // coins
    for (let i = 0; i < 4; i++) part(new THREE.CylinderGeometry(.22, .22, .06, 28), '#ffffff', 1.0 + (i % 2) * .1, 1.34 + i * .065, .45, g).material = M('#2775ca');
    coinFlow(8.9, 3, [-.2, .2], .42, .45);
  }
  // 05 · rabbit: a glazed rabbit bank (a generated model, its own colours). CRRT coins drop in through the slot on its
  // back and are gone for good; a certificate comes out
  { const g = group(ST[4] + .1, .1, 2.55);   // three-quarter on, so the white backs of the ears show
    const gl = o.model ? await new GLTFLoader().loadAsync(o.model).catch(() => null) : null;
    if (gl) {
      const m = gl.scene; const box = new THREE.Box3().setFromObject(m), sz = box.getSize(new THREE.Vector3()), k = 3.6 / sz.y;
      m.scale.setScalar(k); m.position.set(-(box.min.x + sz.x / 2) * k, -box.min.y * k + .3, -(box.min.z + sz.z / 2) * k);
      // its own colours (white glaze, blue ears and collar), lit like the rest of the scene; both sides, so no seam ever shows through
      m.traverse(c => { if (!c.isMesh) return; const src = c.material; c.material = new THREE.MeshStandardMaterial({ map: src.map || null, color: src.map ? '#ffffff' : '#eef1f7', roughness: .38, metalness: 0, side: THREE.DoubleSide }); c.castShadow = c.receiveShadow = true; });
      g.add(m);
    }
    part(new THREE.TorusGeometry(1.15, .07, 12, 48), BLUE, 0, .38, 0, g, false).rotation.x = Math.PI / 2;   // a blue ring it sits in
    // grams dropping into the slot
    { const n = 14, im = coins(n), ob = new THREE.Object3D();

      // coins leave the belt one by one, turn on edge and drop into the slot on the rabbit's back
      anims.push(t => { for (let i = 0; i < n; i++) { const u = (i / n + t * .14) % 1, h = Math.sin(u * Math.PI); ob.position.set(ST[4] - 2.4 + u * 2.3, .8 + h * 2 * (1 - u * .2) + u * 1.5, .1 - u * .6); ob.rotation.set(0, 0, Math.min(1, u * 1.6) * Math.PI / 2); ob.scale.setScalar(u > .92 ? (1 - u) * 12.5 : 1); ob.updateMatrix(); im.setMatrixAt(i, ob.matrix); } im.instanceMatrix.needsUpdate = true; }); }
    // the certificate, out in front, with its blue seal
    const cert = new THREE.Group(); cert.position.set(ST[4] + 1.4, .42, 2.1); cert.rotation.set(0, -.5, 0); scene.add(cert);
    part(rbox(1.1, .03, .8, .02), '#ffffff', 0, 0, 0, cert);
    for (let i = 0; i < 3; i++) part(new THREE.BoxGeometry(.6 - i * .12, .005, .05), i ? '#c9d1e2' : INK, -.15, .02, -.22 + i * .16, cert, false);
    part(new THREE.CylinderGeometry(.13, .13, .02, 24), BLUE, .32, .025, .18, cert, false);
  }
  // 06 · TRCR · DAO: a control tower overseeing the line, wired to the endorser and the market
  { const g = group(ST[5], -.5);
    part(new THREE.CylinderGeometry(.75, 1.05, 4.6, 6), WHITE, 0, 2.6, 0, g);
    part(new THREE.CylinderGeometry(1.35, 1.35, .9, 6), WHITE, 0, 5.35, 0, g);
    part(new THREE.CylinderGeometry(1.42, 1.42, .14, 6), BLUE, 0, 5.85, 0, g);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; part(rbox(.05, .5, .8, .02), '#bcd2ff', Math.cos(a) * 1.3, 5.35, Math.sin(a) * 1.3, g, false).rotation.y = -a; }
    part(new THREE.CylinderGeometry(.04, .04, 1.6, 8), WHITE, 0, 6.7, 0, g); part(new THREE.SphereGeometry(.12, 12, 10), BLUE, 0, 7.55, 0, g, false);
    // TRCR coins stacked at its foot
    for (let i = 0; i < 5; i++) part(new THREE.CylinderGeometry(.3, .3, .08, 32), BLUE, 1.5, .34 + i * .085, 1.2, g);
    // wires: dashed arcs from the tower to every station it governs
    const top = new THREE.Vector3(ST[5], 6.8, -.5);
    for (const x of [ST[1], ST[2], ST[3]]) { const end = new THREE.Vector3(x, 3.9, -.3); const c = new THREE.QuadraticBezierCurve3(top, top.clone().lerp(end, .5).add(new THREE.Vector3(0, 4 + (ST[5] - x) * .12, -1.5)), end);
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getPoints(80)), new THREE.LineDashedMaterial({ color: BLUE, dashSize: .3, gapSize: .2 })); l.computeLineDistances(); scene.add(l); }
  }
  
  // ---- light ----
  scene.add(new THREE.HemisphereLight('#ffffff', '#aeb8cf', .75));
  const sun = new THREE.DirectionalLight('#fffaf2', 1.45); sun.position.set(-14, 26, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(o.shadow, o.shadow); sun.shadow.radius = 5; sun.shadow.bias = -.0004;
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 18, bottom: -18, near: 1, far: 80 }); sun.target.position.set(2, 0, 0); scene.add(sun, sun.target);
  return { scene, ST };
}

export async function createFactory(app, el) {
  if (!el) return null;
  const stage = el.querySelector('[data-fx-stage]'), signsBox = el.querySelector('[data-fx-signs]'), sec = el.closest('section') || el;
  const items = JSON.parse(el.dataset.items || '[]');
  const T = { n: el.querySelector('[data-fx-n]'), t: el.querySelector('[data-fx-t]'), b: el.querySelector('[data-fx-b]') };
  const bars = [...el.querySelectorAll('.fx-steps li')];
  let R;
  try { R = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch (e) { el.classList.add('fx-nogl'); return null; }
  R.outputEncoding = THREE.sRGBEncoding; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.setClearColor('#e9edf5', 1);
  stage.appendChild(R.domElement);
  await document.fonts.ready;   // the signs painted on the parts use the site's fonts
  const anims = [];
  const { scene, ST } = await buildScene({ model: el.dataset.model, shadow: app.quality === 'low' ? 1024 : 2048 }, anims);

  // ---- the camera: one fixed isometric direction; each stop is a framing (which part of the world fills which part
  // of the stage); scrolling eases from one framing to the next, pausing on each ----
  const DIR = new THREE.Vector3(-14, 17, 24).normalize(), LOOK = new THREE.Vector3(2, 0, 0);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
  cam.position.copy(LOOK).addScaledVector(DIR, 60); cam.lookAt(LOOK); cam.updateMatrixWorld();
  const inv = cam.matrixWorldInverse.clone();
  const box = (x0, x1, z0, z1, y1) => { const p = []; for (const x of [x0, x1]) for (const z of [z0, z1]) for (const y of [0, y1]) p.push(new THREE.Vector3(x, y, z)); return p; };
  const HT = [3, 4.6, 4.2, 3.6, 4.6, 8.4];   // how tall each station is (for its framing and its sign)
  const SETS = [box(ST[0] - 3.9, ST[5] + 3.2, -3.6, 3.6, 2).concat([new THREE.Vector3(ST[5], 8.8, -.5)]),
    ...ST.map((x, i) => box(x - (i ? 3 : 3.9), x + 3, -3, 3, HT[i] + .5))];
  const STOPS = [0, 1, 2, 3, 4, 5, 6, 0];   // the whole line, each station, the whole line again
  const frame = (pts, rect, aspect) => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const v = new THREE.Vector3();
    for (const p of pts) { v.copy(p).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    const [l, r, b, t] = rect, hh = Math.max((y1 - y0) / ((t - b) * 2), (x1 - x0) / ((r - l) * 2 * aspect));
    return [(x0 + x1) / 2 - (l + r) * hh * aspect, (y0 + y1) / 2 - (b + t) * hh, hh];   // left, bottom, half-height
  };
  let W = 0, H = 0, frames = [];
  const fit = () => {
    const r = stage.getBoundingClientRect(); W = r.width; H = r.height; const narrow = W < 820;
    R.setPixelRatio(Math.min(devicePixelRatio || 1, app.quality === 'low' ? 1 : 1.5)); R.setSize(W, H, false);
    // where the model sits (fractions of the stage: left, right, bottom, top): right of the copy on wide screens, under it on phones
    const OVER = narrow ? [.03, .97, .04, .56] : [.03, .98, .05, .82], AT = narrow ? [.06, .94, .05, .5] : [.42, .96, .08, .84];
    frames = SETS.map((pts, i) => frame(pts, i ? AT : OVER, W / H));
  };
  fit(); addEventListener('resize', fit);

  // ---- signs: one per station, pinned above it ----
  const ANCH = ST.map((x, i) => new THREE.Vector3(x, HT[i] + .1, i === 5 ? -.5 : 0));
  const signs = items.map((it, i) => { const d = document.createElement('div'); d.className = 'fx-sign'; d.innerHTML = `<i>0${i + 1}</i><b></b>`; d.querySelector('b').textContent = it.sign || it.title; signsBox.appendChild(d); return d; });

  let seen = false, p = 0, shown = -1;
  const t0 = performance.now();
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; }, { threshold: 0 }).observe(el);
  const ease = x => x * x * (3 - 2 * x), v = new THREE.Vector3();
  const api = { get p() { return p; }, scene };
  window.__factory = api;   // for stills and QA
  app.add((t, dt) => {
    if (!seen || !W) return;
    // scroll → a place along the stops; each step rests on its stop, then glides to the next
    const sr = sec.getBoundingClientRect(), span = Math.max(1, sr.height - innerHeight);
    const want = Math.max(0, Math.min(1, -sr.top / span)) * (STOPS.length - 1);
    p = app.reduced ? want : p + (want - p) * Math.min(1, dt * 7);
    const i = Math.min(STOPS.length - 2, Math.floor(p)), e = ease(Math.min(1, Math.max(0, (p - i - .22) / .56)));
    const A = frames[STOPS[i]], B = frames[STOPS[i + 1]];
    const L = A[0] + (B[0] - A[0]) * e, Bt = A[1] + (B[1] - A[1]) * e, hh = A[2] + (B[2] - A[2]) * e;
    cam.left = L; cam.right = L + hh * 2 * W / H; cam.bottom = Bt; cam.top = Bt + hh * 2; cam.updateProjectionMatrix();
    const at = STOPS[e < .5 ? i : i + 1];   // 0: the whole line · 1–6: a station
    if (at !== shown) {
      shown = at; el.classList.toggle('at-station', at > 0);
      signs.forEach((s, k) => { s.classList.toggle('on', k === at - 1); s.classList.toggle('dim', at > 0 && k !== at - 1); });
      bars.forEach((b, k) => b.classList.toggle('on', k === at - 1));
      if (at > 0) { const it = items[at - 1]; T.n.textContent = `0${at} / 0${items.length}`; T.t.textContent = it.title; T.b.textContent = it.body; }
    }
    const time = app.reduced ? 0 : (performance.now() - t0) / 1000;
    for (const a of anims) a(time);
    R.render(scene, cam);
    for (let k = 0; k < signs.length; k++) {
      v.copy(ANCH[k]).project(cam); const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
      signs[k].style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      signs[k].style.visibility = x < -60 || x > W + 60 || y < -60 || y > H + 60 ? 'hidden' : '';
    }
  }, 72);
  return api;
}
