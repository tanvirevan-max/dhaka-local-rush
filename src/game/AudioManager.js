// Audio: everything is synthesised with the Web Audio API (no audio files required).
//  - Engine (gearbox + diesel rumble + turbo), horns, bicycle bells, tyre squeal, crashes, police siren, traffic + market ambience
//  - Bengali voice lines: recorded files from public/assets/audio/manifest.json if present, else the browser's Bengali
//    speech voice (if installed), else subtitles only. Cooldowns + priorities keep dialogue readable.
//  - Separate volume groups: master, engine, traffic, voice, effects.
import { DIALOGUE, VOICE_RULES } from '../config/dialogue.js';
import { clamp, rand, randPick } from './utils.js';

const GEARS = [0, 6.5, 12, 18, 25, 45];

function noiseBuffer(ctx, seconds, type = 'white') {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return buf;
}

export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.ready = false;
    this.paused = false;
    this.buffers = {};
    this.recorded = {};            // voice id -> url
    this.voiceBn = null;
    this.speaking = null;          // { priority, until }
    this.lastLineAt = -99;
    this.catLast = {};
    this.lastId = {};
    this.ambientTimer = rand(...VOICE_RULES.ambientEvery);
    this.onSubtitle = null;        // (line) => void
    this.gear = 0; this.rpm = 700; this.hornHeld = false;
    this._sirenOn = false; this._skid = 0;
    this._initSpeech();
  }

  // ---- setup ------------------------------------------------------------------------------------
  _initSpeech() {
    if (typeof speechSynthesis === 'undefined') return;
    const pick = () => {
      const vs = speechSynthesis.getVoices() || [];
      this.voiceBn = vs.find((v) => /^bn[-_]BD/i.test(v.lang)) || vs.find((v) => /^bn/i.test(v.lang)) || vs.find((v) => /bengali|bangla/i.test(v.name)) || null;
    };
    pick();
    try { speechSynthesis.addEventListener('voiceschanged', pick); } catch (e) { /* ignore */ }
  }

  /** Call from a user gesture (Play button). Safe to call repeatedly. */
  async unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      await this.ctx.resume().catch(() => {});
      this._build();
      this.ready = true;
      this._loadManifest();
    } catch (e) { console.warn('Audio unavailable', e); this.ctx = null; }
  }

  _build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.master.connect(this.comp); this.comp.connect(c.destination);
    this.gEngine = c.createGain(); this.gTraffic = c.createGain(); this.gEffects = c.createGain();
    for (const g of [this.gEngine, this.gTraffic, this.gEffects]) g.connect(this.master);
    this.white = noiseBuffer(c, 2, 'white');
    this.brown = noiseBuffer(c, 4, 'brown');
    this._buildEngine();
    this._buildAmbience();
    this._buildSiren();
    this._buildSkid();
    this.applyVolumes();
  }

  applyVolumes(s = this.settings) {
    this.settings = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.05);
    this.gEngine.gain.setTargetAtTime(s.engine, t, 0.05);
    this.gTraffic.gain.setTargetAtTime(s.traffic, t, 0.05);
    this.gEffects.gain.setTargetAtTime(s.effects, t, 0.05);
  }

  async _loadManifest() {
    try {
      const res = await fetch(new URL('assets/audio/manifest.json', document.baseURI));
      if (!res.ok) return;
      const m = await res.json();
      this.recorded = m.voice || {};
      for (const [name, path] of Object.entries(m.sfx || {})) {
        try {
          const r = await fetch(new URL('assets/audio/' + path, document.baseURI));
          if (r.ok) this.buffers[name] = await this.ctx.decodeAudioData(await r.arrayBuffer());
        } catch (e) { /* optional file missing: synth fallback */ }
      }
    } catch (e) { /* no manifest: fully synthesised */ }
  }

  // ---- continuous sources -------------------------------------------------------------------------
  _buildEngine() {
    const c = this.ctx;
    this.oscA = c.createOscillator(); this.oscA.type = 'sawtooth';
    this.oscB = c.createOscillator(); this.oscB.type = 'square';
    this.oscC = c.createOscillator(); this.oscC.type = 'triangle';
    this.gA = c.createGain(); this.gB = c.createGain(); this.gC = c.createGain();
    this.gA.gain.value = 0.5; this.gB.gain.value = 0.28; this.gC.gain.value = 0.35;
    this.engLP = c.createBiquadFilter(); this.engLP.type = 'lowpass'; this.engLP.frequency.value = 400; this.engLP.Q.value = 1.4;
    this.engOut = c.createGain(); this.engOut.gain.value = 0;
    this.oscA.connect(this.gA).connect(this.engLP); this.oscB.connect(this.gB).connect(this.engLP); this.oscC.connect(this.gC).connect(this.engLP);
    this.engLP.connect(this.engOut).connect(this.gEngine);
    // diesel knock: noise gated by a slow LFO
    this.knock = c.createBufferSource(); this.knock.buffer = this.white; this.knock.loop = true;
    const kbp = c.createBiquadFilter(); kbp.type = 'bandpass'; kbp.frequency.value = 700; kbp.Q.value = 0.8;
    this.knockGain = c.createGain(); this.knockGain.gain.value = 0;
    this.knockLfo = c.createOscillator(); this.knockLfo.type = 'square'; this.knockLfo.frequency.value = 20;
    const lfoDepth = c.createGain(); lfoDepth.gain.value = 0.5;
    this.knockOffset = c.createConstantSource ? c.createConstantSource() : null;
    this.knockLfo.connect(lfoDepth).connect(this.knockGain.gain);
    this.knock.connect(kbp).connect(this.knockGain).connect(this.engOut);
    // turbo whistle (boost)
    this.turbo = c.createOscillator(); this.turbo.type = 'sine'; this.turbo.frequency.value = 1800;
    this.turboGain = c.createGain(); this.turboGain.gain.value = 0;
    this.turbo.connect(this.turboGain).connect(this.gEngine);
    // wind rush (speed)
    this.wind = c.createBufferSource(); this.wind.buffer = this.white; this.wind.loop = true;
    this.windHP = c.createBiquadFilter(); this.windHP.type = 'highpass'; this.windHP.frequency.value = 900;
    this.windGain = c.createGain(); this.windGain.gain.value = 0;
    this.wind.connect(this.windHP).connect(this.windGain).connect(this.gTraffic);
    for (const n of [this.oscA, this.oscB, this.oscC, this.knock, this.knockLfo, this.turbo, this.wind]) n.start();
  }

  _buildAmbience() {
    const c = this.ctx;
    this.roar = c.createBufferSource(); this.roar.buffer = this.brown; this.roar.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    this.roarGain = c.createGain(); this.roarGain.gain.value = 0;
    this.roar.connect(lp).connect(this.roarGain).connect(this.gTraffic);
    this.mkt = c.createBufferSource(); this.mkt.buffer = this.white; this.mkt.loop = true;
    this.mktBP = c.createBiquadFilter(); this.mktBP.type = 'bandpass'; this.mktBP.frequency.value = 1100; this.mktBP.Q.value = 0.7;
    this.mktGain = c.createGain(); this.mktGain.gain.value = 0;
    this.mkt.connect(this.mktBP).connect(this.mktGain).connect(this.gTraffic);
    this.roar.start(); this.mkt.start();
    this.babbleT = 0;
  }

  _buildSiren() {
    const c = this.ctx;
    this.sirenOsc = c.createOscillator(); this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 800;
    this.sirenOsc2 = c.createOscillator(); this.sirenOsc2.type = 'square'; this.sirenOsc2.frequency.value = 800;
    const g2 = c.createGain(); g2.gain.value = 0.12;
    this.sirenLP = c.createBiquadFilter(); this.sirenLP.type = 'lowpass'; this.sirenLP.frequency.value = 2400;
    this.sirenGain = c.createGain(); this.sirenGain.gain.value = 0;
    this.sirenPan = c.createStereoPanner ? c.createStereoPanner() : null;
    this.sirenOsc.connect(this.sirenLP); this.sirenOsc2.connect(g2).connect(this.sirenLP);
    this.sirenLP.connect(this.sirenGain);
    if (this.sirenPan) this.sirenGain.connect(this.sirenPan).connect(this.gEffects); else this.sirenGain.connect(this.gEffects);
    this.sirenOsc.start(); this.sirenOsc2.start();
    this.sirenPhase = 0;
  }

  _buildSkid() {
    const c = this.ctx;
    this.skid = c.createBufferSource(); this.skid.buffer = this.white; this.skid.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2300; bp.Q.value = 4;
    this.skidGain = c.createGain(); this.skidGain.gain.value = 0;
    this.skid.connect(bp).connect(this.skidGain).connect(this.gEffects);
    this.skid.start();
  }

  // ---- per-frame update ---------------------------------------------------------------------------
  /**
   * s = { playing, speed, maxSpeed, throttle, brake, boosting, trafficDensity, market, policeActive, policeDist, policeDx, skid }
   */
  update(dt, s) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const run = s.playing && !this.paused;
    // gearbox
    const sp = Math.max(0, s.speed);
    let g = 0;
    while (g < GEARS.length - 2 && sp > GEARS[g + 1]) g++;
    const lo = GEARS[g], hi = GEARS[g + 1];
    let rpm01 = clamp((sp - lo) / (hi - lo), 0, 1);
    if (g === 0) rpm01 = clamp(sp / hi, 0, 1);
    if (g !== this.gear) { this.gear = g; this.rpm -= 450; }
    const idle = 700, red = 2500;
    const targetRpm = idle + rpm01 * (red - idle) * (0.55 + 0.45 * Math.max(s.throttle, 0.25)) + s.throttle * 250 + (s.boosting ? 250 : 0);
    this.rpm += (targetRpm - this.rpm) * clamp(dt * 7, 0, 1);
    const f0 = this.rpm / 20;
    this.oscA.frequency.setTargetAtTime(f0, t, 0.03);
    this.oscB.frequency.setTargetAtTime(f0 * 0.5, t, 0.03);
    this.oscC.frequency.setTargetAtTime(f0 * 1.5, t, 0.03);
    this.knockLfo.frequency.setTargetAtTime(f0 * 0.5, t, 0.05);
    this.engLP.frequency.setTargetAtTime(240 + this.rpm * 0.22 + s.throttle * 520, t, 0.06);
    this.engOut.gain.setTargetAtTime(run ? 0.16 + s.throttle * 0.17 + rpm01 * 0.08 + (s.boosting ? 0.06 : 0) : 0, t, 0.1);
    this.knockGain.gain.setTargetAtTime(run ? 0.05 + s.throttle * 0.06 : 0, t, 0.1);
    this.turbo.frequency.setTargetAtTime(1500 + (this.rpm - 700) * 1.2, t, 0.05);
    this.turboGain.gain.setTargetAtTime(run && s.boosting ? 0.035 : run && s.throttle > 0.5 ? 0.008 : 0, t, 0.08);
    this.windGain.gain.setTargetAtTime(run ? clamp(sp / 40, 0, 1) ** 2 * 0.1 : 0, t, 0.15);
    // ambience
    this.roarGain.gain.setTargetAtTime(run || s.playing ? (0.16 + (s.trafficDensity || 1) * 0.12 + clamp(sp / 40, 0, 1) * 0.08) : 0.08, t, 0.4);
    this.mktGain.gain.setTargetAtTime(run ? (s.market || 0) * 0.075 : 0, t, 0.5);
    this.mktBP.frequency.setTargetAtTime(700 + Math.sin(t * 0.7) * 300 + Math.sin(t * 1.9) * 200, t, 0.2);
    // market babble: short syllable-like noise bursts through random formants
    this.babbleT -= dt;
    if (run && (s.market || 0) > 0.25 && this.babbleT <= 0) { this.babbleT = rand(0.12, 0.45) / Math.max(0.3, s.market); this._syllable((s.market || 0) * 0.05); }
    // tyre squeal
    this._skid += ((s.skid || 0) - this._skid) * clamp(dt * 12, 0, 1);
    this.skidGain.gain.setTargetAtTime(run ? this._skid * 0.09 : 0, t, 0.05);
    // police siren: "wail" sweep, louder when closer; panned by relative x
    const sirenOn = run && s.policeActive;
    if (sirenOn) {
      this.sirenPhase += dt * 0.55;
      const sweep = 0.5 + 0.5 * Math.sin(this.sirenPhase * Math.PI * 2);
      const fr = 650 + sweep * 700;
      this.sirenOsc.frequency.setTargetAtTime(fr, t, 0.02); this.sirenOsc2.frequency.setTargetAtTime(fr * 1.5, t, 0.02);
      const vol = clamp(1 - (s.policeDist || 200) / 260, 0.04, 1);
      this.sirenGain.gain.setTargetAtTime(vol * 0.2, t, 0.1);
      if (this.sirenPan) this.sirenPan.pan.setTargetAtTime(clamp((s.policeDx || 0) / 40, -0.8, 0.8), t, 0.1);
    } else this.sirenGain.gain.setTargetAtTime(0, t, 0.15);
    // helper chatter timer
    if (run) this.ambientTimer -= dt;
  }

  /** True when it is time for an ambient helper call (the Game decides which line). */
  consumeAmbient() {
    if (this.ambientTimer > 0) return false;
    this.ambientTimer = rand(...VOICE_RULES.ambientEvery);
    return true;
  }

  setPaused(p) {
    this.paused = p;
    if (!this.ctx) return;
    if (p) { this.ctx.suspend().catch(() => {}); try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } } else this.ctx.resume().catch(() => {});
  }

  // ---- one-shots ----------------------------------------------------------------------------------
  _env(gainNode, t, a, d, peak) {
    gainNode.gain.cancelScheduledValues(t);
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + a);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  _out(pan, group = this.gEffects) {
    const c = this.ctx;
    if (c.createStereoPanner && pan) { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(group); return p; }
    return group;
  }

  _playBuffer(name, vol = 1, pan = 0, group = this.gEffects) {
    const buf = this.buffers[name];
    if (!buf) return false;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g).connect(this._out(pan, group));
    src.start();
    return true;
  }

  _syllable(vol) {
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.white; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = rand(350, 1800); f.Q.value = 6;
    const g = c.createGain();
    this._env(g, t, 0.02, rand(0.06, 0.16), vol);
    src.connect(f).connect(g).connect(this._out(rand(-0.8, 0.8), this.gTraffic));
    src.start(t, rand(0, 1)); src.stop(t + 0.3);
  }

  /** kind: bus | truck | car | cng | moto | bell. dist/pan only for other vehicles. */
  horn(kind = 'bus', { vol = 1, pan = 0, dur = 0.5 } = {}) {
    if (!this.ready || this.paused) return;
    if (kind === 'bell') return this.bell(vol, pan);
    if (this._playBuffer('horn', vol, pan)) return;
    const c = this.ctx, t = c.currentTime;
    const sets = {
      bus: { f: [311, 392, 466], type: 'sawtooth', gain: 0.22 },
      truck: { f: [196, 247, 294], type: 'sawtooth', gain: 0.24 },
      car: { f: [420, 520], type: 'square', gain: 0.12 },
      cng: { f: [560, 700], type: 'square', gain: 0.1 },
      moto: { f: [720, 900], type: 'square', gain: 0.08 },
    };
    const set = sets[kind] || sets.bus;
    const out = this._out(pan);
    const g = c.createGain();
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(set.gain * vol, t + 0.03);
    g.gain.setValueAtTime(set.gain * vol, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    g.connect(lp).connect(out);
    for (const f of set.f) { const o = c.createOscillator(); o.type = set.type; o.frequency.value = f * (1 + rand(-0.01, 0.01)); o.connect(g); o.start(t); o.stop(t + dur + 0.2); }
  }

  /** Player horn held down. */
  hornHold(down, kind = 'bus') {
    if (!this.ready) return;
    if (down && !this.hornHeld) {
      this.hornHeld = true;
      const c = this.ctx, t = c.currentTime;
      this.hornNodes = { g: c.createGain(), os: [] };
      this.hornNodes.g.gain.setValueAtTime(0.0001, t);
      this.hornNodes.g.gain.exponentialRampToValueAtTime(0.24, t + 0.04);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      this.hornNodes.g.connect(lp).connect(this.gEffects);
      for (const f of [311, 392, 466]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(this.hornNodes.g); o.start(t); this.hornNodes.os.push(o); }
    } else if (!down && this.hornHeld) {
      this.hornHeld = false;
      const t = this.ctx.currentTime, h = this.hornNodes;
      h.g.gain.cancelScheduledValues(t);
      h.g.gain.setValueAtTime(h.g.gain.value, t);
      h.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      for (const o of h.os) o.stop(t + 0.15);
      this.hornNodes = null;
    }
  }

  bell(vol = 1, pan = 0) {
    if (!this.ready || this.paused) return;
    if (this._playBuffer('bell', vol, pan)) return;
    const c = this.ctx, out = this._out(pan);
    for (let k = 0; k < 2; k++) {
      const t = c.currentTime + k * 0.17;
      for (const [f, a] of [[2093, 0.07], [3136, 0.04], [4186, 0.02]]) {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const g = c.createGain(); this._env(g, t, 0.003, 0.5, a * vol);
        o.connect(g).connect(out); o.start(t); o.stop(t + 0.6);
      }
    }
  }

  crash(impulse, heavy = false, pan = 0) {
    if (!this.ready || this.paused) return;
    const vol = clamp(impulse / 40000, 0.12, 1);
    if (this._playBuffer('crash', vol, pan)) return;
    const c = this.ctx, t = c.currentTime, out = this._out(pan);
    const n = c.createBufferSource(); n.buffer = this.white;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = heavy ? 700 : 1500; bp.Q.value = 0.9;
    const ng = c.createGain(); this._env(ng, t, 0.004, 0.18 + vol * 0.25, 0.5 * vol);
    n.connect(bp).connect(ng).connect(out); n.start(t, rand(0, 1)); n.stop(t + 0.7);
    const th = c.createOscillator(); th.type = 'sine'; th.frequency.setValueAtTime(heavy ? 120 : 160, t); th.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    const tg = c.createGain(); this._env(tg, t, 0.004, 0.3, 0.7 * vol);
    th.connect(tg).connect(out); th.start(t); th.stop(t + 0.4);
    for (const f of heavy ? [150, 227, 310] : [260, 410]) {
      const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f * rand(0.95, 1.05);
      const g = c.createGain(); this._env(g, t, 0.003, 0.12 + vol * 0.14, 0.08 * vol);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.5);
    }
  }

  boost() {
    if (!this.ready || this.paused) return;
    const c = this.ctx, t = c.currentTime;
    const n = c.createBufferSource(); n.buffer = this.white;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.7);
    const g = c.createGain(); this._env(g, t, 0.1, 0.7, 0.28);
    n.connect(bp).connect(g).connect(this.gEffects); n.start(t); n.stop(t + 1);
    this.rpm += 500;
  }

  chime(kind = 'award') {
    if (!this.ready || this.paused) return;
    const c = this.ctx, t = c.currentTime;
    const notes = kind === 'pickup' ? [660, 880, 1175] : kind === 'escape' ? [523, 659, 784, 1047] : kind === 'bad' ? [220, 165] : [880, 1320];
    notes.forEach((f, i) => {
      const o = c.createOscillator(); o.type = kind === 'bad' ? 'sawtooth' : 'sine'; o.frequency.value = f;
      const g = c.createGain(); this._env(g, t + i * 0.08, 0.005, 0.25, kind === 'bad' ? 0.06 : 0.09);
      o.connect(g).connect(this.gEffects); o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.4);
    });
  }

  // ---- Bengali voice lines ------------------------------------------------------------------------
  /**
   * Say a random line from DIALOGUE[category]. Returns the line (for subtitles) or null when blocked by cooldown/priority.
   * priority: 1 ambient, 2 reaction, 3 important (may interrupt lower priority).
   */
  say(category, { priority = 2, force = false } = {}) {
    const lines = DIALOGUE[category];
    if (!lines || !lines.length) return null;
    const now = performance.now() / 1000;
    const busy = this.speaking && now < this.speaking.until;
    if (!force) {
      if (busy && priority <= this.speaking.priority) return null;
      if (now - this.lastLineAt < VOICE_RULES.globalCooldown && !(busy === false && priority > 2) && priority < 3) return null;
      if (this.catLast[category] && now - this.catLast[category] < VOICE_RULES.perCategoryCooldown && priority < 3) return null;
    }
    let line = randPick(lines);
    if (lines.length > 1 && this.lastId[category] === line.id) line = lines[(lines.indexOf(line) + 1) % lines.length];
    this.lastId[category] = line.id;
    this.lastLineAt = now; this.catLast[category] = now;
    const dur = clamp(line.t.length * 0.075 + 0.5, 1.2, 4.5);
    this.speaking = { priority, until: now + dur };
    this._speak(line);
    if (this.onSubtitle) this.onSubtitle(line, dur);
    return line;
  }

  _speak(line) {
    if (!this.ready || this.paused) return;
    const vol = clamp(this.settings.voice * this.settings.master, 0, 1);
    if (vol <= 0.01) return;
    const url = this.recorded[line.id];
    if (url) {
      try { const a = new Audio(new URL('assets/audio/' + url, document.baseURI)); a.volume = vol; a.play().catch(() => {}); return; } catch (e) { /* fall through to TTS */ }
    }
    if (!this.voiceBn || typeof speechSynthesis === 'undefined') return;
    try {
      if (this.speaking && this.speaking.priority >= 3) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(line.t);
      u.voice = this.voiceBn; u.lang = this.voiceBn.lang; u.volume = vol;
      const who = line.who;
      u.pitch = who === 'helper' ? 1.15 : who === 'police' ? 0.8 : who === 'ped' ? 1.25 : who === 'rick' ? 0.95 : 0.9;
      u.rate = who === 'helper' ? 1.15 : who === 'police' ? 0.95 : 1.05;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  get hasBengaliVoice() { return !!this.voiceBn; }
}
