// Police pursuit. Rules (all numbers in config POLICE):
//  - "Heat" builds when you ram traffic or drive on the oncoming carriageway. At 100 the police join the chase.
//  - Units spawn 110-140 m BEHIND you (out of sight), drive on the road, steer around traffic and chase at a speed that
//    rises with the pursuit level (every 22 s in pursuit, max 3). More levels = more units.
//  - A unit within bustRadius fills the BUSTED meter; when it hits 100 % you are arrested (game over).
//  - Stay > escapeDistance ahead for escapeSeconds to escape. Boost is your friend.
import * as THREE from 'three';
import { POLICE, WORLD } from '../config/gameConfig.js';
import { getVehicleGeometry, POLICE_LIGHT } from './models/index.js';
import { Vehicle, vehicleMaterial } from './Vehicle.js';
import { laneCenter } from './TrafficManager.js';
import { clamp, rand } from './utils.js';

let _halo = null;
function haloTexture() {
  if (_halo) return _halo;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.3, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  _halo = new THREE.CanvasTexture(c);
  return _halo;
}

export class PoliceManager {
  constructor(scene, { low = false } = {}) {
    this.scene = scene;
    this.low = low;
    this.units = [];
    this.pool = [];
    this.events = [];
    this.redMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
    this.blueMat = new THREE.MeshBasicMaterial({ color: 0x2a5cff });
    this.dimMat = new THREE.MeshBasicMaterial({ color: 0x2a1010 });
    this.dimBlueMat = new THREE.MeshBasicMaterial({ color: 0x101a33 });
    this.lightGeo = new THREE.BoxGeometry(POLICE_LIGHT.size[0], POLICE_LIGHT.size[1], POLICE_LIGHT.size[2]);
    this.haloRed = new THREE.SpriteMaterial({ map: haloTexture(), color: 0xff3030, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.haloBlue = new THREE.SpriteMaterial({ map: haloTexture(), color: 0x3a6bff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.reset();
  }

  reset() {
    for (const u of this.units) this._release(u);
    this.units.length = 0;
    this.heat = 0;
    this.active = false;
    this.level = 0;
    this.levelTimer = 0;
    this.cooldown = POLICE.initialGrace;
    this.escapeTimer = 0;
    this.bust = 0;
    this.pursuitTime = 0;
    this.nearest = Infinity;
    this.spawnDelay = 0;
    this.flash = 0;
    this.leaving = false;
    this.bustedFired = false;
    this.events.length = 0;
  }

  addHeat(amount) { if (!this.active && this.cooldown <= 0) this.heat = clamp(this.heat + amount, 0, POLICE.heatThreshold * 1.2); else if (this.active) this.heat = Math.min(POLICE.heatThreshold * 1.2, this.heat + amount * 0.3); }

  /** 0..1 progress towards escaping (only meaningful while a pursuit is active). */
  get escape01() { return clamp(this.escapeTimer / POLICE.escapeSeconds, 0, 1); }
  get bust01() { return clamp(this.bust / 100, 0, 1); }
  get heat01() { return clamp(this.heat / POLICE.heatThreshold, 0, 1); }

  // ---- unit pool ---------------------------------------------------------------------------------
  _make() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(getVehicleGeometry('police'), vehicleMaterial());
    group.add(body);
    const lights = [];
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(this.lightGeo, sx < 0 ? this.redMat : this.blueMat);
      m.position.set(sx * POLICE_LIGHT.xOff, POLICE_LIGHT.y, POLICE_LIGHT.z);
      const halo = new THREE.Sprite(sx < 0 ? this.haloRed : this.haloBlue);
      halo.position.set(sx * POLICE_LIGHT.xOff * 1.2, POLICE_LIGHT.y + 0.3, POLICE_LIGHT.z);
      halo.scale.setScalar(3.4);
      group.add(m, halo);
      lights.push({ mesh: m, halo, side: sx });
    }
    const v = new Vehicle('police', group);
    v.kind = 'police';
    v.lights = lights;
    this.scene.add(group);
    return v;
  }

  _acquire() { const v = this.pool.pop() || this._make(); v.mesh.visible = true; return v; }

  _release(u) { u.active = false; u.mesh.visible = false; u.mesh.scale.setScalar(1); this.pool.push(u); }

  // ---- pursuit lifecycle -------------------------------------------------------------------------
  _spawnUnit(player, traffic, level) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const lane = Math.floor(Math.random() * WORLD.laneCount);
      const x = laneCenter(1, lane);
      const z = player.z + rand(POLICE.spawnBehind[0], POLICE.spawnBehind[1]) + attempt * 12;
      let free = true;
      for (const o of traffic.list) if (Math.abs(o.x - x) < 2.4 && Math.abs(o.z - z) < 14) { free = false; break; }
      for (const u of this.units) if (Math.abs(u.x - x) < 2.4 && Math.abs(u.z - z) < 14) { free = false; break; }
      if (!free) continue;
      const u = this._acquire();
      u.reset(x, z, 0, Math.max(18, player.vf));
      u.dir = 1; u.maxSpeed = 60; u.accel = POLICE.accel; u.brakeDecel = u.h.brake;
      u.flashT = Math.random();
      u.sirenSeed = Math.random();
      u.prep(); u.syncMesh(0);
      this.units.push(u);
      return u;
    }
    return null;
  }

  _start(player, traffic) {
    this.active = true; this.level = 1; this.levelTimer = 0; this.escapeTimer = 0; this.pursuitTime = 0; this.bust = 0; this.leaving = false;
    this._spawnUnit(player, traffic, 1);
    this.events.push({ type: 'start' });
  }

  _escape() {
    this.active = false; this.leaving = true;
    this.heat = 0; this.level = 0; this.bust = 0; this.escapeTimer = 0;
    this.cooldown = POLICE.cooldownAfterEscape;
    this.events.push({ type: 'escape' });
  }

  /** Units that are done: drive away / fade out. */
  _dismiss(u) { u.removeNow = true; }

  // ---- per frame ----------------------------------------------------------------------------------
  update(dt, player, traffic, ctx) {
    this.events.length = 0;
    this.flash += dt;
    if (this.cooldown > 0) this.cooldown -= dt;

    if (!this.active) {
      if (!this.leaving) this.heat = Math.max(0, this.heat - POLICE.heatDecay * dt);
      if (this.heat >= POLICE.heatThreshold && this.cooldown <= 0) this._start(player, traffic);
    } else {
      this.pursuitTime += dt;
      this.levelTimer += dt;
      if (this.level < POLICE.maxLevel && this.levelTimer >= POLICE.levelEvery) {
        this.levelTimer = 0; this.level++;
        this.events.push({ type: 'levelUp', level: this.level });
      }
      // keep the right number of units on the road
      this.spawnDelay -= dt;
      if (this.units.length < this.level && this.spawnDelay <= 0) { this.spawnDelay = 3.5; this._spawnUnit(player, traffic, this.level); }
    }

    // drive + housekeeping
    let nearest = Infinity;
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.removeNow) {
        u.fade -= dt * 2.5;
        if (u.fade <= 0.05) { this._release(u); this.units.splice(i, 1); continue; }
      }
      if (this.active) {
        // far behind and unreachable: replace with a fresh unit out of sight instead of teleporting next to the player
        if (u.z - player.z > 300 || Math.abs(u.x) > WORLD.wallHalfWidth + 2 || u.contactTime > 3.5) { this._dismiss(u); this.spawnDelay = Math.min(this.spawnDelay, 0.2); }
        this._drive(u, dt, player, traffic);
      } else {
        // pursuit over: ease off and let the player pull away
        u.throttle = 0; u.brake = 0.35; u.steer = 0;
        if (!u.removeNow && (u.z - player.z > 160 || this.leaving)) this._dismiss(u);
      }
      u.flashT += dt;
      this._flashLights(u);
      const d = Math.hypot(u.x - player.x, u.z - player.z);
      if (!u.removeNow && d < nearest) nearest = d;
    }
    this.nearest = nearest;
    if (this.units.length === 0) this.leaving = false;

    if (this.active) {
      // bust meter
      let close = false;
      for (const u of this.units) {
        if (u.removeNow) continue;
        if (Math.hypot(u.x - player.x, u.z - player.z) < POLICE.bustRadius) { close = true; break; }
      }
      this.bust = clamp(this.bust + (close ? POLICE.bustRate : -POLICE.bustDecay) * dt, 0, 100);
      if (this.bust >= 100) { this.bust = 100; if (!this.bustedFired) { this.bustedFired = true; this.events.push({ type: 'busted' }); } }
      // escape meter
      if (nearest > POLICE.escapeDistance || this.units.length === 0) this.escapeTimer += dt;
      else this.escapeTimer = Math.max(0, this.escapeTimer - dt * 1.5);
      if (this.escapeTimer >= POLICE.escapeSeconds) this._escape();
    }
  }

  _flashLights(u) {
    const phase = Math.floor(u.flashT * 8) & 1;
    const [a, b] = u.lights;
    a.mesh.material = phase ? this.redMat : this.dimMat;
    b.mesh.material = phase ? this.dimBlueMat : this.blueMat;
    a.halo.visible = !!phase; b.halo.visible = !phase;
  }

  _drive(u, dt, player, traffic) {
    if (u.stun > 0) { u.throttle = 0; u.brake = 0.15; u.steer = 0; return; }
    const behind = u.z - player.z;                       // > 0: unit is behind the player
    const dist = Math.hypot(u.x - player.x, u.z - player.z);
    let target = POLICE.baseSpeed + (this.level - 1) * POLICE.speedPerLevel;
    if (behind > 0) target += clamp((dist - 30) / 60, 0, 1) * 4.5;
    else target = Math.max(8, player.vf * 0.8);
    if (player.vf < 6 && behind > 0) target = Math.min(target, Math.max(player.vf + 4, 10)); // do not ram a stopped bus at full speed
    // aim for the lane the player is in; sidestep traffic that is in the way
    const vf = u.vf;
    const look = 12 + Math.max(0, vf) * 1.1;
    const candidates = [player.x, player.x - 3.4, player.x + 3.4, u.x, u.x - 3.4, u.x + 3.4];
    let aimX = clamp(player.x, -WORLD.roadHalfWidth + 1.5, WORLD.roadHalfWidth - 1.5), best = Infinity, leaderGap = 1e9, leaderSpeed = 0;
    const blocked = (cx) => {
      let gmin = 1e9, ls = 0;
      const check = (o) => {
        if (o === u || !o.active || o.removeNow) return;
        const dz = u.z - o.z;                              // positive: o is ahead (smaller z)
        if (dz < -2 || dz > look + 8) return;
        if (Math.abs(o.x - cx) > o.halfW + u.halfW + 0.6) return;
        const g = dz - u.halfL - o.halfL;
        if (g < gmin) { gmin = g; ls = o.vf * (o.dir || 1); }
      };
      for (const o of traffic.list) check(o);
      for (const o of this.units) check(o);
      return [gmin, ls];
    };
    for (const cx of candidates) {
      const x = clamp(cx, -WORLD.roadHalfWidth + 1.4, WORLD.roadHalfWidth - 1.4);
      const [g, ls] = blocked(x);
      const score = g < look ? 1000 - g : Math.abs(x - player.x) * 2 + Math.abs(x - u.x);
      if (score < best) { best = score; aimX = x; leaderGap = g; leaderSpeed = ls; }
    }
    if (leaderGap < look) {
      const safe = 4 + Math.max(0, vf) * 0.55;
      target = Math.min(target, Math.max(0, leaderSpeed - (safe - leaderGap) * 0.7));
    }
    const err = target - vf;
    u.throttle = clamp(err / 2, 0, 1);
    u.brake = clamp(-err / 2.5, 0, 1) * (vf > 0.5 ? 1 : 0);
    const e = aimX - u.x;
    const desired = -clamp(e * 0.11, -0.36, 0.36);
    let yawErr = desired - u.yaw;
    while (yawErr > Math.PI) yawErr -= Math.PI * 2;
    while (yawErr < -Math.PI) yawErr += Math.PI * 2;
    u.steer = clamp(-yawErr * 2.6, -1, 1);
    if (Math.abs(yawErr) > 0.9) u.yaw += clamp(yawErr, -1.4 * dt, 1.4 * dt);
  }

  dispose() {
    for (const u of [...this.units, ...this.pool]) u.mesh.removeFromParent();
    this.lightGeo.dispose();
    for (const m of [this.redMat, this.blueMat, this.dimMat, this.dimBlueMat, this.haloRed, this.haloBlue]) m.dispose();
  }
}
