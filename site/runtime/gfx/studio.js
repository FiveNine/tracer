/*
 * Studio lighting for real-looking objects: environment reflections, a light rig and soft contact shadows.
 *
 *   const st = studio(app, {
 *     env: 'softbox' | 'room' | 'sky' | { hdr: 'assets/studio.hdr' },   // what reflects in the object
 *     envIntensity: 1, background: null | '#hex' (solid) ,
 *     key:  { dir: [-1, 2, 1.5], color: '#fff4e6', intensity: 2.2, shadow: false },
 *     fill: { dir: [1.5, 0.6, 1], intensity: 0.35 }, rim: { dir: [0, 1, -2], intensity: 1.2 },
 *     contact: { size: 6, y: 0, opacity: 0.55, blur: 2.6, darkness: 1.3, resolution: 512 }  // soft ground shadow
 *   });
 *   st.contact.update(objects?) — call when objects move (the app does it every frame if contact.auto !== false)
 * Softbox env panels can be tuned: env: { type: 'softbox', panels: [{ pos, size, intensity, color }], ambient: '#hex' }.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export function softboxScene(o = {}) {
  const s = new THREE.Scene();
  const amb = new THREE.Color(o.ambient || '#1a1a1c');
  const room = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: amb, side: THREE.BackSide }));
  s.add(room);
  const panels = o.panels || [
    { pos: [-6, 5, 5], size: [6, 4], intensity: 5, color: '#fff3e2' },   // key softbox, upper left front
    { pos: [7, 2, 3], size: [2.5, 7], intensity: 1.6, color: '#e8eefc' }, // fill strip right
    { pos: [0, 7, -6], size: [9, 2], intensity: 3, color: '#ffffff' },   // top-back rim bar
    { pos: [1.5, 11, 1], size: [7, 5], intensity: 1.1, color: '#fff8ee' }, // overhead: gives top-down shots a reflection
    { pos: [0, -6, 0], size: [16, 16], intensity: 0.12, color: '#ffffff' } // floor bounce
  ];
  for (const p of panels) {
    const c = new THREE.Color(p.color || '#ffffff').multiplyScalar(p.intensity ?? 2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.size[0], p.size[1]), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.fromArray(p.pos); m.lookAt(0, 0, 0); s.add(m);
  }
  return s;
}
export function skyScene(o = {}) {
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(o.zenith || '#5a8fd8') }, mid: { value: new THREE.Color(o.horizon || '#dfe9f2') }, bot: { value: new THREE.Color(o.ground || '#6f6a5f') },
      sun: { value: new THREE.Vector3().fromArray(o.sunDir || [0.4, 0.6, -0.7]).normalize() }, sunCol: { value: new THREE.Color(o.sun || '#fff1d6').multiplyScalar(o.sunIntensity ?? 18) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top, mid, bot, sun, sunCol; varying vec3 vD; void main(){ float y = vD.y; vec3 c = y > 0.0 ? mix(mid, top, pow(y, 0.6)) : mix(mid, bot, pow(-y, 0.4)); float s = pow(max(dot(vD, sun), 0.0), 900.0) + 0.08 * pow(max(dot(vD, sun), 0.0), 12.0); gl_FragColor = vec4(c + sunCol * s, 1.0); }'
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), mat));
  return s;
}

export function studio(app, o = {}) {
  const { renderer, scene } = app;
  const out = { lights: {}, contact: null, envMap: null };
  if (!app.gl) return out;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = o.env === undefined ? 'softbox' : o.env;
  const setEnv = t => { out.envMap = t; scene.environment = t; };
  if (env === 'room') setEnv(pm.fromScene(new RoomEnvironment(), 0.04).texture);
  else if (env === 'sky' || (env && env.type === 'sky')) setEnv(pm.fromScene(skyScene(env.type ? env : o.sky || {}), 0.02).texture);
  else if (env && env.hdr) new RGBELoader().load(env.hdr, t => { t.mapping = THREE.EquirectangularReflectionMapping; setEnv(pm.fromEquirectangular(t).texture); t.dispose(); });
  else if (env) setEnv(pm.fromScene(softboxScene(typeof env === 'object' ? env : {}), 0.03).texture);
  if (o.background) scene.background = new THREE.Color(o.background);
  // env intensity is per material in r149: apply to every standard material that doesn't set its own
  out.applyEnvIntensity = (v = o.envIntensity ?? 1) => scene.traverse(m => { if (m.material && 'envMapIntensity' in m.material && !m.material.userData.envFixed) m.material.envMapIntensity = v; });

  const L = (k, d) => {
    const c = Object.assign({}, d, o[k]); if (o[k] === false) return null;
    const l = new THREE.DirectionalLight(new THREE.Color(c.color || '#ffffff'), c.intensity);
    l.position.fromArray(c.dir).normalize().multiplyScalar(10);
    if (c.shadow) { l.castShadow = true; l.shadow.mapSize.set(2048, 2048); l.shadow.bias = -0.0004; l.shadow.normalBias = 0.02; const s = c.shadowSize || 4; Object.assign(l.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 30 }); l.shadow.radius = c.shadowRadius || 6; }
    scene.add(l); if (l.target) scene.add(l.target); out.lights[k] = l; return l;
  };
  L('key', { dir: [-1, 2, 1.5], color: '#fff4e6', intensity: 2.2 });
  L('fill', { dir: [1.5, 0.6, 1], color: '#e9efff', intensity: 0.35 });
  L('rim', { dir: [0, 1, -2], color: '#ffffff', intensity: 1.2 });
  if (o.ambient) { const a = new THREE.HemisphereLight(new THREE.Color(o.ambient.sky || '#ffffff'), new THREE.Color(o.ambient.ground || '#444444'), o.ambient.intensity ?? 0.3); scene.add(a); out.lights.ambient = a; }
  if (o.contact !== false) out.contact = contactShadow(app, o.contact || {});
  return out;
}

/**
 * Soft contact shadow: render the scene's depth from under a ground plane, blur it twice, lay it on the plane.
 * Cheap, soft and grounded; it follows moving objects (update each frame, or on demand with auto: false).
 */
export function contactShadow(app, o = {}) {
  const { renderer, scene } = app;
  const size = o.size || 6, res = o.resolution || (app.quality === 'low' ? 256 : 512), y = o.y || 0;
  const group = new THREE.Group(); group.position.y = y; scene.add(group);
  const rtA = new THREE.WebGLRenderTarget(res, res), rtB = new THREE.WebGLRenderTarget(res, res);
  rtA.texture.generateMipmaps = rtB.texture.generateMipmaps = false;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: rtA.texture, transparent: true, opacity: o.opacity ?? 0.55, depthWrite: false, color: new THREE.Color(o.color || '#000000') }));
  plane.renderOrder = 1; plane.scale.y = -1; plane.material.map.encoding = THREE.LinearEncoding; group.add(plane);
  plane.material.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', 'vec4 sampledDiffuseColor = texture2D( map, vUv ); diffuseColor = vec4(diffuseColor.rgb, diffuseColor.a * sampledDiffuseColor.a);'); };
  const cam = new THREE.OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 0, o.height || 2.5);
  cam.rotation.x = Math.PI / 2; group.add(cam);
  const depthMat = new THREE.MeshDepthMaterial(); depthMat.depthTest = false; depthMat.depthWrite = false;
  const dark = o.darkness ?? 1.3;
  depthMat.onBeforeCompile = sh => { sh.uniforms.darkness = { value: dark }; sh.fragmentShader = 'uniform float darkness;\n' + sh.fragmentShader.replace('gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );'); };
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv; void main(){ vec4 s = vec4(0.0); float w[5]; w[0]=0.227027; w[1]=0.1945946; w[2]=0.1216216; w[3]=0.054054; w[4]=0.016216; s += texture2D(tDiffuse, vUv) * w[0]; for (int i = 1; i < 5; i++){ vec2 o = uDir * float(i); s += texture2D(tDiffuse, vUv + o) * w[i] + texture2D(tDiffuse, vUv - o) * w[i]; } gl_FragColor = s; }',
    depthTest: false, depthWrite: false
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat); quad.frustumCulled = false;
  const qs = new THREE.Scene(); qs.add(quad); const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blurAmt = o.blur ?? 2.6;
  function blur(amount) {
    blurMat.uniforms.tDiffuse.value = rtA.texture; blurMat.uniforms.uDir.value.set(amount / res, 0); renderer.setRenderTarget(rtB); renderer.render(qs, qc);
    blurMat.uniforms.tDiffuse.value = rtB.texture; blurMat.uniforms.uDir.value.set(0, amount / res); renderer.setRenderTarget(rtA); renderer.render(qs, qc);
  }
  const api = {
    group, plane, auto: o.auto !== false,
    update() {
      const bg = scene.background, env = scene.environment; scene.background = null;
      const vis = []; scene.traverse(m => { if (m.isMesh && m !== plane && (m.userData.noShadow || (m.material.transparent && !m.userData.castContact))) { vis.push([m, m.visible]); m.visible = false; } });
      plane.visible = false; scene.overrideMaterial = depthMat;
      const prevClear = renderer.getClearAlpha(); renderer.setClearAlpha(0);
      renderer.setRenderTarget(rtA); renderer.clear(); renderer.render(scene, cam);
      scene.overrideMaterial = null; plane.visible = true; vis.forEach(([m, v]) => { m.visible = v; });
      blur(blurAmt); blur(blurAmt * 0.4);
      renderer.setRenderTarget(null); renderer.setClearAlpha(prevClear); scene.background = bg; scene.environment = env;
    }
  };
  if (api.auto) app.add(() => api.update(), 1000); // after everything moved this frame
  return api;
}
