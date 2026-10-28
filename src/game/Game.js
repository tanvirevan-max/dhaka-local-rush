// Game: owns the renderer, the world systems and the main loop. All rules live here:
//   input -> boost/energy -> traffic + police AI -> vehicle physics -> collisions -> scoring / damage / heat / audio -> HUD.
// States: loading | menu | playing | paused | over.   Balance numbers are in config/gameConfig.js.
import * as THREE from 'three';
import { BOOST, DAMAGE, PLAYER_BUSES, POLICE, SCORING } from '../config/gameConfig.js';
import { Environment } from './Environment.js';
import { TrafficManager, laneCenter } from './TrafficManager.js';
import { PoliceManager } from './PoliceManager.js';
import { MissionManager } from './MissionManager.js';
import { CollisionManager } from './CollisionManager.js';
import { PlayerBus } from './PlayerBus.js';
import { CameraController } from './CameraController.js';
import { Effects } from './Effects.js';
import { InputManager } from './InputManager.js';
import { ScoreManager } from './ScoreManager.js';
import { AudioManager } from './AudioManager.js';
import { loadSettings, saveSettings } from './Storage.js';
import { waitForBengaliFont } from './Textures.js';
import { HUD } from '../ui/HUD.js';
import { Menus } from '../ui/Menus.js';
import { clamp, damp, isLowEndDevice, toBn } from './utils.js';

const REACT = { rickshaw: 'react_rick', bicycle: 'react_rick', cng: 'react_cng', motorcycle: 'react_moto', car: 'react_driver', bus: 'react_driver', truck: 'react_driver' };
const START_Z = -30;
const STEP = 1 / 55; // max physics step (s)

export class Game {
  constructor({ canvas, hudRoot, menuRoot }) {
    this.canvas = canvas;
    this.settings = loadSettings();
    this.state = 'loading';
    this.low = this.wantLow();
    this.debug = /[?&]debug/.test(location.search);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.low, powerPreference: 'high-performance' });
    this.prMax = Math.min(window.devicePixelRatio || 1, this.low ? 1.25 : 2);
    this.pr = this.prMax;
    this.scene = new THREE.Scene();
    this.fx = new Effects(this.scene);
    this.camera = new CameraController(window.innerWidth / Math.max(1, window.innerHeight));
    this.camera.shakeEnabled = this.settings.shake;
    this.input = new InputManager();
    this.score = new ScoreManager((e) => this.onScoreEvent(e));
    this.audio = new AudioManager(this.settings);
    this.audio.onSubtitle = (line, dur) => {
      if (this.settings.subtitles && this.hud) this.hud.subtitle(line, dur);
      if (line.who === 'helper' && this.bus) this.bus.helper.talk(dur * 0.9);
    };
    this.collisions = new CollisionManager();
    this.bodies = [];

    this.hud = new HUD(hudRoot, this.input);
    this.hud.onPause = () => this.togglePause();
    this.menus = new Menus(menuRoot, {
      settings: this.settings,
      best: () => this.score.best,
      bengaliVoice: () => this.audio.hasBengaliVoice,
      onPlay: () => this.onPlay(),
      onResume: () => this.resume(),
      onRestart: () => this.startRun(),
      onMenu: () => this.enterMenu(),
      onSettings: (s) => this.onSettings(s),
    });

    this.input.on('pause', () => this.togglePause());
    this.input.on('restart', () => { if (this.state === 'playing' || this.state === 'paused' || this.state === 'over') this.startRun(); });
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.pause(); document.getElementById('webgl-error')?.classList.remove('hidden'); });
    canvas.addEventListener('webglcontextrestored', () => document.getElementById('webgl-error')?.classList.add('hidden'));

    // run state
    this.energy = BOOST.maxEnergy; this.boosting = false; this.boostDelay = 0;
    this.integrity = 100; this.dmgCd = 0; this.ramCd = 0; this.wallCd = 0; this.crashSfxCd = 0; this.crashSfxImp = 0; this.stuckT = 0;
    this.runTime = 0; this.minZ = START_Z; this.ending = null; this.timeScale = 1;
    this.lastNm = null; this.warnCd = 0; this.idleT = 0; this.wrongWay = false; this.wrongWarned = false;
    this.menuT = 0; this.last = 0;
    this._hs = { police: {} };
    this.perf = { acc: 0, n: 0, t: 0 };

    this.resize();
    this.frame = this.frame.bind(this);
  }

  // ---- setup --------------------------------------------------------------------------------------------------
  wantLow() {
    const q = (/[?&]q=(low|high)/.exec(location.search) || [])[1] || this.settings.quality;
    return q === 'low' || (q === 'auto' && isLowEndDevice());
  }

  async init() {
    await waitForBengaliFont();
    this.buildWorld();
    this.buildBus();
    this.env.refreshTextures();
    this.resize();
    this.enterMenu();
    requestAnimationFrame(this.frame);
    if (this.debug) window.__game = this;
  }

  buildWorld() {
    this.env = new Environment(this.scene, { low: this.low });
    this.traffic = new TrafficManager(this.scene, { low: this.low });
    this.police = new PoliceManager(this.scene, { low: this.low });
    this.missions = new MissionManager(this.scene, this.env, this.score, (t, d) => this.onMission(t, d));
    this.traffic.onHorn = (v) => this.audio.horn(v.def.horn, { vol: clamp(1 - this.distTo(v) / 90, 0.12, 0.8), pan: this.panOf(v.x) });
    this.traffic.onJam = (on) => {
      if (on && this.state === 'playing') { this.hud.popup('সামনে জ্যাম!', 'Traffic jam ahead', 'info'); this.audio.say('helper_warn', { priority: 1 }); }
    };
  }

  disposeWorld() {
    this.missions.dispose(); this.police.dispose(); this.traffic.dispose(); this.env.dispose();
  }

  buildBus() {
    if (this.bus) { this.scene.remove(this.bus.group); this.bus.dispose(); }
    const idx = Math.max(0, PLAYER_BUSES.findIndex((b) => b.id === this.settings.busId));
    this.busCfg = PLAYER_BUSES[idx];
    this.busId = this.busCfg.id;
    this.bus = new PlayerBus(this.busCfg, idx + 1);
    this.scene.add(this.bus.group);
    this.player = this.bus.vehicle;
  }

  resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(w, h, false);
    this.camera.setAspect(w / h);
    this.fx.setViewport(h * this.pr, this.camera.camera.fov);
  }

  // ---- state transitions -------------------------------------------------------------------------------------
  onPlay() {
    this.audio.unlock();
    if (!this.settings.tutorialSeen) {
      this.menus.showTutorial('start', () => { this.settings.tutorialSeen = true; saveSettings(this.settings); this.startRun(); });
    } else this.startRun();
  }

  onSettings(s) {
    this.settings = s;
    saveSettings(s);
    this.audio.applyVolumes(s);
    this.camera.shakeEnabled = s.shake;
    if (this.state === 'menu' && s.busId !== this.busId) { this.buildBus(); this.parkBus(); }
  }

  parkBus() {
    const p = this.player;
    p.reset(laneCenter(1, 1), START_Z, 0, 0);
    p.prep(); p.syncMesh(0);
  }

  enterMenu() {
    this.state = 'menu';
    this.input.setEnabled(false);
    this.hud.show(false);
    this.traffic.clear();
    this.police.reset();
    this.fx.clear();
    this.score.reset();
    this.env.reset(START_Z);
    this.parkBus();
    this.audio.setPaused(false);
    this.menus.showStart();
  }

  applyQuality() {
    const low = this.wantLow();
    if (low !== this.low) {
      this.low = low;
      this.disposeWorld();
      this.buildWorld();
      this.env.refreshTextures();
    }
    this.prMax = Math.min(window.devicePixelRatio || 1, this.low ? 1.25 : 2);
    this.pr = this.prMax;
    this.resize();
  }

  startRun() {
    this.applyQuality();
    if (this.settings.busId !== this.busId) this.buildBus();
    const p = this.player, cfg = this.busCfg;
    this.env.reset(START_Z);
    p.reset(laneCenter(1, 1), START_Z, 0, 10);
    p.maxSpeed = cfg.maxSpeed; p.accel = cfg.accel; p.steerScale = 1;
    p.prep(); p.syncMesh(0);
    this.traffic.reset(p, this.env);
    this.police.reset();
    this.score.reset();
    this.missions.reset(START_Z);
    this.fx.clear();
    this.collisions.events.length = 0;
    this.energy = BOOST.maxEnergy; this.boosting = false; this.boostDelay = 0;
    this.integrity = 100; this.dmgCd = 0; this.ramCd = 0; this.wallCd = 0; this.crashSfxCd = 0; this.crashSfxImp = 0; this.stuckT = 0;
    this.runTime = 0; this.minZ = START_Z; this.ending = null; this.timeScale = 1;
    this.lastNm = null; this.warnCd = 3; this.idleT = 0; this.wrongWay = false; this.wrongWarned = false;
    this.camera.snap({ x: p.x, z: p.z, yaw: p.yaw, speed: p.vf, boosting: false });
    this.hud.reset();
    this.hud.show(true);
    this.menus.hide();
    this.input.releaseAll();
    this.input.setEnabled(true);
    this.audio.setPaused(false);
    this.audio.ambientTimer = 7;
    this.state = 'playing';
    setTimeout(() => { if (this.state === 'playing') { this.audio.say('helper_start', { priority: 3, force: true }); this.bus.helper.gesture('cheer', 1.6); } }, 500);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.setEnabled(false);
    this.audio.hornHold(false);
    this.audio.setPaused(true);
    this.menus.showPause();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.menus.hide();
    this.state = 'playing';
    this.input.setEnabled(true);
    this.audio.setPaused(false);
    this.last = performance.now();
  }

  togglePause() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') { if (this.menus.screen === 'pause') this.resume(); else this.menus.showPause(); }
  }

  beginEnding(reason) {
    if (this.ending || this.state !== 'playing') return;
    this.ending = { reason, t: reason === 'busted' ? 1.5 : 2.0 };
    this.audio.hornHold(false);
    this.hud.flash(reason === 'busted' ? 'police' : 'hit');
    this.audio.say(reason === 'busted' ? 'police_bust' : 'helper_crash', { priority: 3, force: true });
    this.bus.helper.gesture('flinch', 2);
    this.audio.chime('bad');
    this.camera.addShake(0.8);
  }

  finishRun() {
    const reason = this.ending ? this.ending.reason : 'wrecked';
    const result = this.score.finish();
    this.state = 'over';
    this.input.setEnabled(false);
    this.audio.hornHold(false);
    try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    this.hud.show(false);
    this.menus.showGameOver(result, reason);
    if (this.debug) console.log('[run over]', reason, JSON.stringify(result));
  }

  // ---- main loop --------------------------------------------------------------------------------------------
  frame(now) {
    requestAnimationFrame(this.frame);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 0.1);
    if (this.state === 'playing') this.playStep(dt);
    else if (this.state === 'menu' || this.state === 'over') this.idleStep(dt);
    if (this.state !== 'paused') this.hud.tick(dt, this.settings.subtitles);
    this.renderer.render(this.scene, this.camera.camera);
  }

  /** Test hook (used with ?debug): advance the simulation without rendering. */
  debugAdvance(seconds, dt = 1 / 30, beforeStep = null) {
    const n = Math.round(seconds / dt);
    for (let i = 0; i < n && this.state === 'playing'; i++) {
      if (beforeStep) beforeStep(i);
      this.playStep(dt);
    }
  }

  idleStep(dt) {
    this.menuT += dt;
    const p = this.player;
    const a = -2.35 + Math.sin(this.menuT * 0.22) * 0.35;
    const R = this.state === 'menu' ? 9.5 : 12;
    const cam = this.camera.camera;
    cam.position.set(p.x + Math.sin(a) * R, 2.9 + Math.sin(this.menuT * 0.3) * 0.25, p.z + Math.cos(a) * R);
    cam.lookAt(p.x, 1.7, p.z);
    this.bus.animate(dt, { braking: false, boosting: false, fx: this.fx, throttle: 0 });
    this.fx.update(dt);
    this.env.followCamera(cam.position, p.z, dt);
    this.audio.update(dt, { playing: false, speed: 0, throttle: 0, boosting: false, trafficDensity: 0.4, market: 0 });
  }

  playStep(dt) {
    const inp = this.input;
    inp.update(dt);
    this.timeScale += ((this.ending ? 0.4 : 1) - this.timeScale) * damp(6, dt);
    const sdt = dt * this.timeScale;
    const steps = Math.max(1, Math.ceil(sdt / STEP));
    const h = sdt / steps;
    this.difficulty = 1 + Math.min(0.45, this.runTime / 300);
    for (let i = 0; i < steps; i++) this.physicsStep(h);
    if (this.ending) { this.ending.t -= dt; if (this.ending.t <= 0) { this.finishRun(); return; } }
    this.afterPhysics(sdt, dt);
  }

  // ---- physics step ------------------------------------------------------------------------------------------
  controlPlayer(h) {
    const p = this.player, inp = this.input, cfg = this.busCfg;
    const dead = !!this.ending;
    let throttle = dead ? 0 : inp.throttle, brake = dead ? 0.6 : inp.brake;
    const steer = dead ? 0 : inp.steer;
    const wantBoost = !dead && inp.boost;
    if (this.boosting) {
      if (!wantBoost || this.energy <= 0) this.boosting = false;
    } else if (wantBoost && this.energy >= BOOST.minToStart && p.vf > -1) {
      this.boosting = true;
      this.audio.boost(); this.hud.flash('boost'); this.bus.helper.gesture('cheer', 1.2);
      this.audio.say('helper_boost', { priority: 1 });
    }
    if (this.boosting) {
      this.energy = Math.max(0, this.energy - BOOST.drain * h);
      this.boostDelay = BOOST.regenDelay;
      throttle = 1; brake = 0;
    } else {
      this.boostDelay -= h;
      if (this.boostDelay <= 0) this.energy = Math.min(BOOST.maxEnergy, this.energy + BOOST.regen * h);
    }
    p.maxSpeed = this.boosting ? cfg.boostSpeed : cfg.maxSpeed;
    p.accel = this.boosting ? cfg.boostAccel : cfg.accel;
    p.steerScale = this.boosting ? BOOST.steerPenalty : 1;
    p.throttle = throttle; p.brake = brake; p.steer = steer;
    // Self-righting assist: a bus left sideways after a spin-out slowly swings back to face down the road.
    let yawErr = -p.yaw;
    yawErr -= Math.round(yawErr / (Math.PI * 2)) * Math.PI * 2;
    if (!dead && Math.abs(yawErr) > 0.8 && Math.abs(p.vf) < 3.5) this.stuckT += h; else this.stuckT = 0;
    if (this.stuckT > 1.2) p.yaw += clamp(yawErr, -0.8 * h, 0.8 * h);
  }

  physicsStep(h) {
    const p = this.player;
    this.runTime += h;
    this.dmgCd -= h; this.ramCd -= h; this.wallCd -= h; this.crashSfxCd -= h;
    this.controlPlayer(h);
    this.traffic.update(h, p, this.env, this.difficulty);
    this.police.update(h, p, this.traffic, null);
    this.handlePoliceEvents();

    const bodies = this.bodies;
    bodies.length = 0;
    bodies.push(p);
    for (const v of this.traffic.list) bodies.push(v);
    for (const u of this.police.units) bodies.push(u);
    for (let i = 0; i < bodies.length; i++) bodies[i].step(h);
    this.collisions.update(h, bodies, this.env);
    this.handleCollisions();
    this.trackNearMisses();

    // soft limit: the road behind the furthest point reached is closed (no endless reversing out of the streamed world)
    if (p.z > this.minZ + 110) { p.z = this.minZ + 110; if (p.vz > 0) p.vz = 0; }

    // wrong way: driving on the oncoming carriageway attracts the police
    const wrong = p.x > 0.5 && p.vf > 4;
    if (wrong) {
      this.police.addHeat(POLICE.wrongWayHeatPerSec * h);
      if (!this.wrongWay && !this.wrongWarned) {
        this.wrongWarned = true;
        this.hud.popup('উল্টো পথ!', 'Wrong way – police notice', 'bad');
        this.audio.say('helper_warn', { priority: 2 });
      }
    } else if (p.x < -1) this.wrongWarned = false;
    this.wrongWay = wrong;

    if (this.integrity <= 0 && !this.ending) this.beginEnding('wrecked');
  }

  // ---- police ------------------------------------------------------------------------------------------------
  handlePoliceEvents() {
    for (const e of this.police.events) {
      if (e.type === 'start') {
        this.hud.flash('police');
        this.hud.popup('পুলিশ ধাওয়া!', 'Police pursuit', 'bad');
        this.audio.say('helper_police', { priority: 3 });
        this.bus.helper.gesture('point', 2);
      } else if (e.type === 'levelUp') {
        this.hud.popup('★'.repeat(e.level), 'আরও পুলিশ · more units', 'bad');
        this.audio.say('police_chase', { priority: 2 });
      } else if (e.type === 'escape') {
        this.score.stats.escapes++;
        this.score.award('escape', SCORING.policeEscape, { combo: false });
        this.hud.flash('good');
        this.audio.chime('escape');
        this.audio.say('helper_escape', { priority: 3 });
        this.bus.helper.gesture('cheer', 2.5);
      } else if (e.type === 'busted') this.beginEnding('busted');
    }
  }

  // ---- collisions -------------------------------------------------------------------------------------------
  handleCollisions() {
    const p = this.player;
    for (const e of this.collisions.events) {
      const A = e.a, B = e.b;
      if (e.type === 'wall') {
        if (A === p && this.wallCd <= 0) {
          this.wallCd = 0.4;
          this.integrity -= DAMAGE.wall;
          this.score.wallPenalty();
          this.fx.sparks(e.px, 0.8, e.pz, 6, 4);
          this.audio.crash(Math.min(e.impulse, 20000), false, this.panOf(e.px));
          this.camera.addShake(0.3);
        }
        continue;
      }
      if (A.kind !== 'player') A.applyHit(e.impulse, Math.sign(-(e.nx * A.rx + e.nz * A.rz)));
      if (B && B.kind !== 'player') B.applyHit(e.impulse, Math.sign(e.nx * B.rx + e.nz * B.rz));
      const involvesPlayer = A === p || B === p;
      const d = Math.hypot(e.px - p.x, e.pz - p.z);
      this.fx.sparks(e.px, 0.9, e.pz, Math.min(14, 2 + Math.floor(e.impulse / 3500)), 3 + Math.min(5, e.impulse / 8000));
      if (e.impulse > 7000) this.fx.dust(e.px, 0.5, e.pz, Math.min(8, 2 + Math.floor(e.impulse / 7000)), 3);
      if ((involvesPlayer || d < 50) && (this.crashSfxCd <= 0 || e.impulse > this.crashSfxImp * 1.5)) {
        this.crashSfxCd = 0.14; this.crashSfxImp = e.impulse;
        this.audio.crash(e.impulse * (involvesPlayer ? 1 : 0.55), e.impulse > 25000, this.panOf(e.px));
      }
      if (involvesPlayer) this.onPlayerHit(e, A === p ? B : A);
    }
  }

  onPlayerHit(e, other) {
    const imp = e.impulse;
    if (other && other._nm) other._nm.hit = true;
    // A single crash produces many consecutive contact events while the bodies grind past each other.
    // Only the first (strongest) one per cooldown window costs integrity / score / heat.
    const first = this.dmgCd <= 0;
    if (first) {
      this.dmgCd = DAMAGE.cooldown;
      if (imp > DAMAGE.threshold) this.integrity -= (imp - DAMAGE.threshold) / DAMAGE.divisor;
      this.score.collisionPenalty(imp);
      if (other && other.kind === 'traffic') this.police.addHeat(Math.min(POLICE.heatMaxPerHit, imp * POLICE.heatPerImpulse));
    }
    if (first || imp > 15000) this.camera.addShake(clamp(imp / 25000, 0.1, 1.1));
    if (imp > 12000) { this.hud.flash('hit'); this.player.stun = Math.max(this.player.stun, 0.4); }
    if (imp > 4000) this.bus.helper.gesture('flinch', 0.9);
    if (other && other.kind === 'traffic') {
      const def = other.def;
      if (def.ram > 0 && imp >= SCORING.ram.minImpulse && this.ramCd <= 0) {
        this.ramCd = SCORING.ram.cooldown;
        this.score.award('ram', def.ram, { combo: false });
      }
      if (first && imp > 3000 && Math.random() < 0.5) this.audio.horn(def.horn === 'bell' ? 'bell' : def.horn, { vol: 0.5, pan: this.panOf(other.x) });
    }
    // voices: heavy hits => helper panics, lighter ones => the other road user shouts, passengers / pedestrians complain
    if (imp > 18000 || !other || other.kind === 'static') this.audio.say('helper_crash', { priority: 3 });
    else if (this.missions.passengers > 0 && imp > 5000 && Math.random() < 0.3) this.audio.say('react_pass', { priority: 2 });
    else if (this.player.x < -11 && Math.random() < 0.4) this.audio.say('react_ped', { priority: 2 });
    else if (other && REACT[other.type]) this.audio.say(REACT[other.type], { priority: 2 });
  }

  // ---- near misses --------------------------------------------------------------------------------------------
  trackNearMisses() {
    const p = this.player, NM = SCORING.nearMiss;
    const sp = Math.abs(p.vf);
    for (const o of this.traffic.list) {
      if (!o.active || o.removeNow || o.tipped) { o._nm = null; continue; }
      const dzAbs = Math.abs(o.z - p.z);
      if (dzAbs < p.halfL + o.halfL) {
        const gap = Math.abs(o.x - p.x) - (p.ex + o.ex);
        if (!o._nm) o._nm = { min: gap, hit: false };
        else if (gap < o._nm.min) o._nm.min = gap;
      } else if (o._nm) {
        const nm = o._nm; o._nm = null;
        if (!nm.hit && nm.min > -0.03 && nm.min <= NM.maxGap && sp >= NM.minPlayerSpeed && !this.ending) {
          const rel = Math.hypot(o.vx - p.vx, o.vz - p.vz);
          if (rel >= NM.minRelSpeed) this.awardNearMiss(o);
        }
      }
    }
  }

  awardNearMiss(o) {
    const NM = SCORING.nearMiss, p = this.player, def = o.def;
    const oncoming = o.dir < 0;
    const side = Math.sign(o.x - p.x) || 1;
    const base = Math.round(NM.base * (def.nm || 1) + (oncoming ? NM.oncomingBonus : 0));
    this.score.stats.nearMisses++;
    this.score.award(oncoming ? 'oncoming' : 'nearMiss', base);
    if (this.lastNm && this.lastNm.side !== side && this.runTime - this.lastNm.t <= SCORING.tightGap.window) {
      this.score.stats.tightGaps++;
      this.score.award('tightGap', SCORING.tightGap.bonus);
      this.audio.say('helper_praise', { priority: 2 });
      this.bus.helper.gesture('cheer', 1.6);
      this.hud.flash('good');
    } else if (p.x < -11 && Math.random() < 0.35) {
      this.audio.say('react_ped', { priority: 1 });   // squeezed past the kerb: pedestrians shout
    } else if (Math.random() < 0.22) {
      this.audio.say('helper_praise', { priority: 1 });
    } else if (Math.random() < 0.3 && REACT[o.type]) {
      this.audio.say(REACT[o.type], { priority: 1 });
    }
    this.lastNm = { side, t: this.runTime };
    this.audio.chime('award');
    if (Math.random() < 0.4) this.audio.horn(def.horn === 'bell' ? 'bell' : def.horn, { vol: 0.6, pan: this.panOf(o.x) });
  }

  // ---- events from the other systems --------------------------------------------------------------------------
  onScoreEvent(e) {
    if (!this.hud) return;
    if (e.type === 'award') {
      const extra = e.kind === 'pickup' && e.extra ? ` · ${e.extra} যাত্রী` : '';
      this.hud.popup(e.label.bn, `+${e.points} ${e.label.en}${extra}${e.multiplier > 1 && e.kind !== 'route' && e.kind !== 'escape' ? ' ×' + e.multiplier : ''}`, 'good');
    } else if (e.type === 'multiplier') {
      this.hud.popup('কম্বো ×' + e.multiplier, 'Combo multiplier', 'info');
    } else if (e.type === 'penalty') {
      this.hud.popup(String(e.points), 'ধাক্কার জরিমানা · crash penalty', 'bad');
    }
  }

  onMission(type, d) {
    if (this.state !== 'playing') return;
    const helper = this.bus.helper;
    switch (type) {
      case 'zone':
        this.hud.banner('এলাকা · AREA', d.zone.name, d.zone.en);
        if (this.runTime > 3) { this.audio.say(d.zone.voiceKey, { priority: 2 }); helper.gesture('call', 2.4); }
        break;
      case 'route':
        this.hud.banner('রুট সম্পূর্ণ!', `রুট ${toBn(d.routes)}`, 'Route complete');
        this.hud.flash('good'); this.audio.chime('escape');
        this.audio.say('helper_zone', { priority: 3 });
        helper.gesture('cheer', 2.5);
        break;
      case 'stopApproach':
        this.audio.say('stop_approach', { priority: 2 });
        helper.gesture('point', 2.6);
        break;
      case 'boardStart':
        this.audio.say('stop_board', { priority: 2 });
        helper.gesture('call', 1.6);
        break;
      case 'pickup':
        this.audio.chime('pickup'); this.hud.flash('good');
        this.audio.say('stop_done', { priority: 2 });
        break;
      case 'stopMissed':
        this.audio.say('stop_missed', { priority: 2 });
        this.hud.popup('স্টপ মিস!', 'Missed the stop', 'bad');
        break;
      default: break;
    }
  }

  // ---- per-frame visuals / audio / HUD ------------------------------------------------------------------------
  afterPhysics(sdt, dt) {
    const p = this.player, inp = this.input;
    if (p.z < this.minZ) { this.score.addDistance(this.minZ - p.z); this.minZ = p.z; }
    this.score.stats.topSpeed = Math.max(this.score.stats.topSpeed, Math.abs(p.vf));
    if (!this.ending) this.score.update(sdt, true);
    this.missions.update(sdt, p, (amt) => { this.integrity = Math.min(100, this.integrity + amt); });

    // visuals
    const braking = this.ending ? true : inp.brake > 0;
    this.bus.animate(dt, { braking, boosting: this.boosting, fx: this.fx, throttle: this.boosting || (!this.ending && inp.throttle > 0) });
    p.syncMesh(dt);
    for (const v of this.traffic.list) v.syncMesh(dt);
    for (const u of this.police.units) u.syncMesh(dt);
    // damaged bus smokes
    if (this.integrity < 45 && Math.random() < dt * (this.integrity < 22 ? 14 : 6)) {
      const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
      this.fx.smoke(p.x - sy * -3.6, 1.7, p.z - cy * -3.6, p.vx * 0.7, p.vz * 0.7, 0x2b2927, 0.55);
    }
    this.camera.update(dt, { x: p.x, z: p.z, yaw: p.yaw, speed: Math.abs(p.vf), boosting: this.boosting });
    this.env.followCamera(this.camera.camera.position, p.z, dt);
    this.env.update(p.z, dt);
    this.fx.update(dt);

    // helper behaviours + audio
    this.helperAI(dt);
    this.audioFrame(dt);
    this.hud.update(this.hudState());
    this.monitorPerformance(dt);
  }

  helperAI(dt) {
    if (this.ending) return;
    const p = this.player;
    this.warnCd -= dt;
    const sp = p.vf;
    if (this.warnCd <= 0 && sp > 9) {
      for (const o of this.traffic.list) {
        const dz = p.z - o.z;
        if (dz < 2 || dz > 30 || !o.active || o.tipped) continue;
        if (Math.abs(o.x - p.x) > p.halfW + o.halfW + 0.4) continue;
        const closing = o.vz - p.vz;
        if (closing > 7 && (dz - p.halfL - o.halfL) / closing < 1.4) {
          this.audio.say('helper_warn', { priority: 2 });
          this.bus.helper.gesture('point', 1.2);
          this.warnCd = 4.5;
          break;
        }
      }
    }
    // dawdling: the helper urges the driver on
    if (Math.abs(sp) < 3 && !this.missions.next?.dwell01 && !this.traffic.jam) this.idleT += dt; else this.idleT = 0;
    if (this.idleT > 7) { this.idleT = 0; this.audio.say('helper_go', { priority: 1 }); }
    if (this.audio.consumeAmbient()) {
      const z = this.missions.zone;
      this.audio.say(Math.random() < 0.6 && z ? z.voiceKey : 'call_generic', { priority: 1 });
      this.bus.helper.gesture('call', 2.2);
    }
  }

  audioFrame(dt) {
    const p = this.player, inp = this.input;
    this.audio.hornHold(inp.horn && !this.ending);
    if (inp.hornPressed && !this.ending) this.nudgeTraffic();
    let near = null, nd = Infinity;
    for (const u of this.police.units) { const d = Math.hypot(u.x - p.x, u.z - p.z); if (d < nd) { nd = d; near = u; } }
    const rx = p.rx, rz = p.rz;
    const vl = p.vx * rx + p.vz * rz;
    const skid = clamp((Math.abs(vl) - 2.2) / 5, 0, 1) + (inp.brake > 0 && p.vf > 12 ? 0.45 : 0);
    const zone = this.missions.zone;
    this.audio.update(dt, {
      playing: true, speed: Math.abs(p.vf), maxSpeed: this.busCfg.maxSpeed, throttle: this.ending ? 0 : this.boosting ? 1 : inp.throttle,
      boosting: this.boosting, trafficDensity: zone ? zone.traffic.density : 1, market: zone ? zone.market : 0,
      policeActive: this.police.active, policeDist: nd, policeDx: near ? near.x - p.x : 0, skid: clamp(skid, 0, 1),
    });
  }

  /** Honking makes bicycles / rickshaws / bikes ahead try to get out of the way. */
  nudgeTraffic() {
    const p = this.player;
    for (const v of this.traffic.list) {
      if (v.dir < 0 || v.tipped || v.stun > 0) continue;
      if (v.type !== 'motorcycle' && v.type !== 'bicycle' && v.type !== 'rickshaw' && v.type !== 'cng') continue;
      const dz = p.z - v.z;
      if (dz > 2 && dz < 32 && Math.abs(v.x - p.x) < 3) this.traffic._tryLaneChange(v, true);
    }
  }

  hudState() {
    const p = this.player, s = this._hs, pol = this.police, m = this.missions;
    s.score = this.score.score; s.best = this.score.bestShown;
    s.speedKmh = Math.abs(p.vf) * 3.6;
    s.boost01 = this.energy / BOOST.maxEnergy; s.boosting = this.boosting;
    s.integrity01 = clamp(this.integrity / 100, 0, 1);
    s.combo = this.score.combo; s.multiplier = this.score.multiplier;
    s.comboTimer01 = clamp(this.score.comboTimer / SCORING.combo.timeout, 0, 1);
    s.zone = m.zone; s.zoneProgress01 = m.zoneProgress01 || 0; s.routeProgress01 = m.routeProgress01;
    s.passengers = m.passengers; s.next = m.next; s.jam = !!this.traffic.jam;
    const ps = s.police;
    ps.state = pol.active ? 'chase' : pol.heat01 > 0.25 ? 'heat' : 'none';
    ps.level = pol.level; ps.maxLevel = POLICE.maxLevel; ps.heat01 = pol.heat01; ps.bust01 = pol.bust01; ps.escape01 = pol.escape01;
    return s;
  }

  // ---- helpers ------------------------------------------------------------------------------------------------
  distTo(v) { return Math.hypot(v.x - this.player.x, v.z - this.player.z); }
  panOf(x) { return clamp((x - this.player.x) / 18, -0.9, 0.9); }

  /** Lower the render resolution when the frame rate is poor (auto quality only), raise it again when there is headroom. */
  monitorPerformance(dt) {
    if (this.settings.quality !== 'auto') return;
    const pf = this.perf;
    pf.acc += dt; pf.n++; pf.t += dt;
    if (pf.t < 2) return;
    const avg = pf.acc / pf.n;
    pf.acc = 0; pf.n = 0; pf.t = 0;
    if (avg > 0.026 && this.pr > 0.7) { this.pr = Math.max(0.7, this.pr * 0.85); this.resize(); }
    else if (avg < 0.015 && this.pr < this.prMax) { this.pr = Math.min(this.prMax, this.pr * 1.12); this.resize(); }
  }
}
