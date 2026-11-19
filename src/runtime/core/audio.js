/*
 * Audio: a small WebAudio engine that needs no audio files (files are supported too).
 *
 * Sound is OFF until the visitor turns it on (browsers require a gesture; good manners anyway). The choice is
 * remembered per site. Everything routes through one master bus with a soft limiter and a shared reverb.
 *
 *   app.audio.enable() / .disable() / .toggle() / .on (bool)      — call enable() from a click/tap
 *   app.audio.ui('tick'|'click'|'whoosh'|'chime'|'thud')           — synthesised interface sounds
 *   app.audio.pad({ notes: [48, 55, 60, 64], level: 0.3, bright: 0.4 })  -> handle { set({notes, level, bright}), stop() }
 *        an evolving ambient chord (detuned oscillators, slow filter drift, long reverb) — music without files
 *   app.audio.noise({ color: 'wind'|'rain'|'room', level: 0.2 })    -> handle { set({level}), stop() }
 *   app.audio.note(midi, { wave: 'saw'|'square'|'triangle'|'sine'|'fm', dur, vel, cutoff, res, attack, release, when })
 *   app.audio.drum('kick'|'snare'|'hat'|'clap'|'tom', { when, vel })
 *   app.audio.sequencer({ bpm: 120, steps: 16, onStep(step, time) }) -> { start(), stop(), bpm }
 *   app.audio.load(url) -> Promise<AudioBuffer>;  app.audio.play(buffer, { loop, level, rate, when }) -> handle
 *   app.audio.level() -> 0..1 smoothed loudness for sound-reactive visuals;  app.audio.waveform() -> Uint8Array (scope) or null
 */
export function createAudio(app, opts = {}) {
  const KEY = 'studio-sound:' + (opts.id || location.pathname);
  let ctx = null, master, comp, reverb, reverbSend, analyser, data, lvl = 0;
  const listeners = new Set();
  const api = {
    on: false, available: typeof window.AudioContext !== 'undefined' || typeof window.webkitAudioContext !== 'undefined',
    get ctx() { return ctx; },
    remembered: () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async enable() {
      if (!api.available) return false;
      init();
      if (ctx.state !== 'running') await ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(opts.volume ?? 0.9, ctx.currentTime, 0.25);
      api.on = true; save(); listeners.forEach(f => f(true)); return true;
    },
    disable() { if (!ctx) return; master.gain.setTargetAtTime(0, ctx.currentTime, 0.2); api.on = false; save(); listeners.forEach(f => f(false)); },
    toggle() { return api.on ? api.disable() : api.enable(); },
    level() { return lvl; },
    /** time-domain samples of the master bus (Uint8Array, 128 = silence) for scopes; null while sound is off */
    waveform() { if (!analyser || !api.on) return null; analyser.getByteTimeDomainData(data); return data; },
    update() {
      if (!analyser || !api.on) { lvl *= 0.9; return; }
      analyser.getByteTimeDomainData(data); let s = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; s += v * v; }
      lvl += (Math.min(1, Math.sqrt(s / data.length) * 3) - lvl) * 0.3;
    }
  };
  function save() { try { localStorage.setItem(KEY, api.on ? '1' : '0'); } catch (e) { } }
  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    analyser = ctx.createAnalyser(); analyser.fftSize = 512; data = new Uint8Array(analyser.fftSize);
    reverb = ctx.createConvolver(); reverb.buffer = impulse(3.2, 2.4);
    reverbSend = ctx.createGain(); reverbSend.gain.value = 0.9;
    reverbSend.connect(reverb); reverb.connect(master);
    master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
  }
  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  let noiseBuf = null;
  function noise() { if (noiseBuf) return noiseBuf; const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return noiseBuf; }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function out(node, wet = 0.2, level = 1) { const g = ctx.createGain(); g.gain.value = level; node.connect(g); g.connect(master); if (wet > 0) { const s = ctx.createGain(); s.gain.value = wet; g.connect(s); s.connect(reverbSend); } return g; }
  const ready = () => ctx && api.on;

  /* ---- interface sounds ---- */
  api.ui = (kind = 'tick', o = {}) => {
    if (!ready()) return;
    const t = ctx.currentTime + (o.when || 0), v = o.vel ?? 1;
    if (kind === 'whoosh') {
      const src = ctx.createBufferSource(); src.buffer = noise();
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.35); f.frequency.exponentialRampToValueAtTime(500, t + 0.8);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18 * v, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.9);
      src.connect(f); f.connect(g); out(g, 0.3); src.start(t); src.stop(t + 1);
      return;
    }
    if (kind === 'thud') { api.drum('kick', { when: o.when, vel: 0.5 * v }); return; }
    const o1 = ctx.createOscillator(), g = ctx.createGain();
    const f0 = { tick: 2200, click: 1400, chime: 880 }[kind] || 1800;
    o1.type = kind === 'chime' ? 'sine' : 'triangle'; o1.frequency.setValueAtTime(f0 * (o.pitch || 1), t);
    if (kind !== 'chime') o1.frequency.exponentialRampToValueAtTime(f0 * 0.5 * (o.pitch || 1), t + 0.05);
    const dur = kind === 'chime' ? 1.6 : 0.07;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime((kind === 'chime' ? 0.12 : 0.07) * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o1.connect(g); out(g, kind === 'chime' ? 0.5 : 0.08); o1.start(t); o1.stop(t + dur + 0.05);
    if (kind === 'chime') { const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = 'sine'; o2.frequency.value = f0 * 2.76 * (o.pitch || 1); g2.gain.setValueAtTime(0.03 * v, t); g2.gain.exponentialRampToValueAtTime(0.0003, t + 0.9); o2.connect(g2); out(g2, 0.5); o2.start(t); o2.stop(t + 1); }
  };

  /* ---- ambient pad: music without files ---- */
  api.pad = (o = {}) => {
    if (!ctx) init();
    const bus = ctx.createGain(); bus.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6;
    bus.connect(lp); const outG = out(lp, o.wet ?? 0.7, 1);
    let voices = [], state = { notes: o.notes || [48, 55, 60, 64, 67], level: o.level ?? 0.28, bright: o.bright ?? 0.35 };
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.05; lfoG.gain.value = 300; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    function build(notes, when) {
      const t = when || ctx.currentTime;
      voices.forEach(v => { v.g.gain.setTargetAtTime(0, t, 1.2); v.oscs.forEach(x => x.stop(t + 6)); });
      voices = notes.map((m, i) => {
        const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(1 / Math.sqrt(notes.length) / 2, t, 1.6);
        const oscs = [-7, 0, 6].map((det, k) => { const x = ctx.createOscillator(); x.type = k === 1 ? 'triangle' : 'sawtooth'; x.frequency.value = mtof(m); x.detune.value = det + (Math.random() - 0.5) * 4; const xg = ctx.createGain(); xg.gain.value = k === 1 ? 0.6 : 0.22; x.connect(xg); xg.connect(g); x.start(t + i * 0.08); return x; });
        g.connect(bus); return { g, oscs };
      });
    }
    function apply() { const t = ctx.currentTime; bus.gain.setTargetAtTime(state.level, t, 1.5); lp.frequency.setTargetAtTime(250 + state.bright * 2600, t, 1.2); }
    build(state.notes); apply();
    return {
      set(s) { const nn = s.notes && s.notes.join() !== state.notes.join(); Object.assign(state, s); if (nn) build(state.notes); apply(); },
      stop(fade = 2) { const t = ctx.currentTime; bus.gain.setTargetAtTime(0, t, fade / 3); voices.forEach(v => v.oscs.forEach(x => x.stop(t + fade + 1))); lfo.stop(t + fade + 1); setTimeout(() => outG.disconnect(), (fade + 1.2) * 1000); }
    };
  };
  /* ---- noise beds: wind, rain, room tone ---- */
  api.noise = (o = {}) => {
    if (!ctx) init();
    const src = ctx.createBufferSource(); src.buffer = noise(); src.loop = true;
    const f = ctx.createBiquadFilter(), g = ctx.createGain(); g.gain.value = 0;
    const color = o.color || 'wind';
    f.type = color === 'rain' ? 'highpass' : 'lowpass'; f.frequency.value = color === 'rain' ? 1800 : color === 'room' ? 300 : 700; f.Q.value = color === 'wind' ? 1.2 : 0.5;
    src.connect(f); f.connect(g); const o2 = out(g, color === 'wind' ? 0.4 : 0.15); src.start();
    let lfo = null;
    if (color === 'wind') { lfo = ctx.createOscillator(); const lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 380; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); }
    const h = { set(s) { if (s.level != null) g.gain.setTargetAtTime(s.level, ctx.currentTime, 1.0); }, stop(fade = 1.5) { g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3); src.stop(ctx.currentTime + fade + 0.5); if (lfo) lfo.stop(ctx.currentTime + fade + 0.5); setTimeout(() => o2.disconnect(), (fade + 1) * 1000); } };
    h.set({ level: o.level ?? 0.15 }); return h;
  };
  /* ---- synth voice ---- */
  api.note = (midi, o = {}) => {
    if (!ready()) return;
    const t = ctx.currentTime + (o.when || 0), dur = o.dur ?? 0.3, vel = o.vel ?? 0.8, freq = typeof midi === 'number' && midi < 200 ? mtof(midi) : midi;
    const vca = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = o.res ?? 4; const cut = o.cutoff ?? 2400;
    f.frequency.setValueAtTime(cut * 0.25, t); f.frequency.exponentialRampToValueAtTime(cut, t + (o.attack ?? 0.005) + 0.04); f.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.35), t + dur + (o.release ?? 0.25));
    const a = o.attack ?? 0.005, r = o.release ?? 0.25;
    vca.gain.setValueAtTime(0, t); vca.gain.linearRampToValueAtTime(0.22 * vel, t + a); vca.gain.setTargetAtTime(0.14 * vel, t + a, 0.08); vca.gain.setTargetAtTime(0, t + dur, r / 3);
    let src;
    if (o.wave === 'fm') {
      src = ctx.createOscillator(); src.frequency.value = freq; const mod = ctx.createOscillator(), mg = ctx.createGain();
      mod.frequency.value = freq * (o.ratio || 2); mg.gain.setValueAtTime(freq * (o.index || 3), t); mg.gain.exponentialRampToValueAtTime(freq * 0.2, t + dur + r);
      mod.connect(mg); mg.connect(src.frequency); mod.start(t); mod.stop(t + dur + r + 0.2);
    } else { src = ctx.createOscillator(); src.type = { saw: 'sawtooth', square: 'square', triangle: 'triangle', sine: 'sine' }[o.wave || 'saw'] || 'sawtooth'; src.frequency.value = freq; if (o.detune) src.detune.value = o.detune; }
    src.connect(f); f.connect(vca); out(vca, o.wet ?? 0.18); src.start(t); src.stop(t + dur + r + 0.3);
  };
  /* ---- drums ---- */
  api.drum = (kind, o = {}) => {
    if (!ready()) return;
    const t = ctx.currentTime + (o.when || 0), v = o.vel ?? 0.9;
    if (kind === 'kick' || kind === 'tom') {
      const x = ctx.createOscillator(), g = ctx.createGain(); const f0 = kind === 'kick' ? 150 : 220, f1 = kind === 'kick' ? 42 : 110;
      x.frequency.setValueAtTime(f0, t); x.frequency.exponentialRampToValueAtTime(f1, t + 0.12);
      g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + (kind === 'kick' ? 0.42 : 0.3));
      x.connect(g); out(g, 0.05); x.start(t); x.stop(t + 0.5); return;
    }
    const src = ctx.createBufferSource(); src.buffer = noise();
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    if (kind === 'hat') { f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.28 * v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + (o.open ? 0.3 : 0.05)); }
    else if (kind === 'clap') { f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.9; g.gain.setValueAtTime(0, t); [0, 0.012, 0.024].forEach(d => { g.gain.setValueAtTime(0.6 * v, t + d); g.gain.exponentialRampToValueAtTime(0.05, t + d + 0.01); }); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.2); }
    else { f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7; g.gain.setValueAtTime(0.55 * v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.18);
      const x = ctx.createOscillator(), xg = ctx.createGain(); x.frequency.setValueAtTime(220, t); x.frequency.exponentialRampToValueAtTime(160, t + 0.08); xg.gain.setValueAtTime(0.35 * v, t); xg.gain.exponentialRampToValueAtTime(0.0005, t + 0.1); x.connect(xg); out(xg, 0.1); x.start(t); x.stop(t + 0.15); }
    src.connect(f); f.connect(g); out(g, kind === 'clap' ? 0.25 : 0.08); src.start(t); src.stop(t + 0.4);
  };
  /* ---- step sequencer with look-ahead scheduling ---- */
  api.sequencer = (o = {}) => {
    const s = { bpm: o.bpm || 120, steps: o.steps || 16, step: 0, playing: false, swing: o.swing || 0 };
    let next = 0, timer = null;
    function tick() {
      const spb = 60 / s.bpm / 4;
      while (next < ctx.currentTime + 0.12) {
        const sw = s.step % 2 ? s.swing * spb : 0;
        o.onStep && o.onStep(s.step, next + sw, next + sw - ctx.currentTime);
        s.step = (s.step + 1) % s.steps; next += spb;
      }
    }
    s.start = () => { if (!ctx) init(); if (s.playing) return; s.playing = true; s.step = 0; next = ctx.currentTime + 0.05; timer = setInterval(tick, 25); tick(); };
    s.stop = () => { s.playing = false; clearInterval(timer); };
    return s;
  };
  /* ---- files ---- */
  api.load = async url => { if (!ctx) init(); const r = await fetch(url); return await ctx.decodeAudioData(await r.arrayBuffer()); };
  api.play = (buf, o = {}) => {
    if (!ctx) init();
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = !!o.loop; src.playbackRate.value = o.rate || 1;
    const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(o.level ?? 0.8, ctx.currentTime, (o.fade || 0.05) / 3);
    src.connect(g); out(g, o.wet ?? 0.1); src.start(ctx.currentTime + (o.when || 0));
    return { src, set(s) { if (s.level != null) g.gain.setTargetAtTime(s.level, ctx.currentTime, 0.3); }, stop(f = 0.4) { g.gain.setTargetAtTime(0, ctx.currentTime, f / 3); src.stop(ctx.currentTime + f + 0.1); } };
  };
  api.midiToFreq = mtof;
  return api;
}
