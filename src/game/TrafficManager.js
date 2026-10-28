// Traffic: pooled vehicles that follow lanes, keep headway, change lanes, queue up in jams, and recover (or vanish) after hits.
// dir = +1: travels with the player (-Z, left carriageway x<0). dir = -1: oncoming (+Z, right carriageway x>0).
import * as THREE from 'three';
import { TRAFFIC, WORLD } from '../config/gameConfig.js';
import { VEHICLE_TYPES } from '../config/vehicles.js';
import { getVehicleGeometry, VARIANT_COUNT } from './models/index.js';
import { Vehicle, vehicleMaterial } from './Vehicle.js';
import { clamp, angleDiff, rand, randPick } from './utils.js';

const LW = WORLD.laneWidth, MH = WORLD.medianHalf;
export const laneCenter = (dir, lane) => (dir > 0 ? -1 : 1) * (MH + LW * (lane + 0.5));
const TYPES = ['bus', 'truck', 'car', 'cng', 'rickshaw', 'motorcycle', 'bicycle'];

export class TrafficManager {
  constructor(scene, { low = false } = {}) {
    this.scene = scene;
    this.max = low ? TRAFFIC.maxVehiclesLow : TRAFFIC.maxVehicles;
    this.list = [];
    this.pool = {};
    for (const t of TYPES) this.pool[t] = [];
    this.spawnTimer = 0;
    this.jam = null;
    this.jamTimer = rand(TRAFFIC.jamEvery[0], TRAFFIC.jamEvery[1]);
    this.onHorn = null;       // (vehicle) => void
    this.onJam = null;        // (active:boolean) => void
    this.difficulty = 1;
    this.hornCooldown = 0;
  }

  // ---- pool -------------------------------------------------------------------------------------
  _acquire(type, variant) {
    let v = this.pool[type].pop();
    if (!v) {
      const mesh = new THREE.Mesh(getVehicleGeometry(type, variant), vehicleMaterial());
      mesh.matrixAutoUpdate = true;
      v = new Vehicle(type, mesh);
      v.kind = 'traffic';
      this.scene.add(mesh);
    } else v.mesh.geometry = getVehicleGeometry(type, variant);
    v.mesh.visible = true;
    return v;
  }

  _release(v) {
    v.active = false;
    v.mesh.visible = false;
    v.mesh.scale.setScalar(1);
    const i = this.list.indexOf(v);
    if (i >= 0) { this.list[i] = this.list[this.list.length - 1]; this.list.pop(); }
    this.pool[v.type].push(v);
  }

  clear() { while (this.list.length) this._release(this.list[this.list.length - 1]); this.jam = null; }

  // ---- spawning ---------------------------------------------------------------------------------
  _pickType(zone) {
    const w = zone.traffic.weights;
    let total = 0;
    for (const t of TYPES) total += (VEHICLE_TYPES[t].weight || 1) * (w[t] || 1);
    let r = Math.random() * total;
    for (const t of TYPES) { r -= (VEHICLE_TYPES[t].weight || 1) * (w[t] || 1); if (r <= 0) return t; }
    return 'car';
  }

  _laneFree(x, z, len, dir, margin = 9) {
    for (const o of this.list) {
      if (Math.abs(o.x - x) < 2.2 && Math.abs(o.z - z) < (o.def.l + len) / 2 + margin) return false;
    }
    return true;
  }

  /** Try to place one vehicle. Returns the vehicle or null. */
  spawn(z, zone, opts = {}) {
    const type = opts.type || this._pickType(zone);
    const def = VEHICLE_TYPES[type];
    const dir = opts.dir !== undefined ? opts.dir : (Math.random() < TRAFFIC.oncomingShare ? -1 : 1);
    const lane = opts.lane !== undefined ? opts.lane : randPick(def.lanes);
    const x = laneCenter(dir, lane);
    if (!this._laneFree(x, z, def.l, dir, opts.margin ?? 10)) return null;
    const variant = Math.floor(Math.random() * VARIANT_COUNT[type]);
    const v = this._acquire(type, variant);
    const cruise = rand(def.speed[0], def.speed[1]);
    v.reset(x, z, dir > 0 ? 0 : Math.PI, opts.speed ?? cruise);
    v.dir = dir; v.lane = lane; v.cruise = cruise;
    v.maxSpeed = Math.max(cruise * 1.25, 4);
    v.accel = v.h.accel; v.brakeDecel = v.h.brake;
    v.laneTimer = rand(1.5, 4); v.offset = 0; v.offsetT = 0; v.idle = 0; v.jammed = false; v.honkT = rand(2, 8);
    v.prep();
    this.list.push(v);
    v.syncMesh(0);
    return v;
  }

  /** Initial population ahead of the player. */
  fill(playerZ, env) {
    this.clear();
    const target = Math.round(this.max * 0.7);
    let tries = 0;
    while (this.list.length < target && tries++ < 200) {
      const z = playerZ - rand(55, TRAFFIC.spawnAheadMax + 30);
      this.spawn(z, env.zoneAt(z).zone, { margin: 8 });
    }
  }

  reset(player, env) {
    this.jamTimer = rand(TRAFFIC.jamEvery[0], TRAFFIC.jamEvery[1]) * 0.8;
    this.spawnTimer = 0;
    this.fill(player.z, env);
  }

  // ---- jams -------------------------------------------------------------------------------------
  _startJam(player, env) {
    const z0 = player.z - rand(170, 230);
    const freeLane = Math.floor(Math.random() * WORLD.laneCount);
    this.jam = { z0, z1: z0 - TRAFFIC.jamLength, until: TRAFFIC.jamDuration, freeLane };
    const zone = env.zoneAt(z0).zone;
    // queue of slow vehicles in the lanes except the free one
    let n = 0;
    for (let z = z0 - 4; z > this.jam.z1 + 4 && n < 12; z -= rand(8, 12)) {
      const lane = Math.floor(Math.random() * WORLD.laneCount);
      if (lane === freeLane) continue;
      const type = Math.random() < 0.55 ? randPick(['car', 'cng', 'bus', 'motorcycle']) : this._pickType(zone);
      if (!VEHICLE_TYPES[type].lanes.includes(lane) && type !== 'bicycle' && type !== 'rickshaw') continue;
      const v = this.spawn(z, zone, { dir: 1, lane: VEHICLE_TYPES[type].lanes.includes(lane) ? lane : VEHICLE_TYPES[type].lanes[0], type, speed: TRAFFIC.jamSpeed, margin: 5 });
      if (v) n++;
    }
    if (this.onJam) this.onJam(true);
  }

  // ---- per-frame --------------------------------------------------------------------------------
  update(dt, player, env, difficulty = 1) {
    this.difficulty = difficulty;
    this.hornCooldown = Math.max(0, this.hornCooldown - dt);
    const zone = env.zoneAt(player.z).zone;
    // jam lifecycle
    if (this.jam) {
      this.jam.until -= dt;
      if (this.jam.until <= 0 || this.jam.z0 > player.z + 60) { this.jam = null; if (this.onJam) this.onJam(false); }
    } else {
      this.jamTimer -= dt;
      if (this.jamTimer <= 0) { this.jamTimer = rand(TRAFFIC.jamEvery[0], TRAFFIC.jamEvery[1]); this._startJam(player, env); }
    }
    // spawn on demand
    const target = clamp(Math.round(this.max * 0.75 * zone.traffic.density * difficulty), 8, this.max);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.list.length < target) {
      this.spawnTimer = 0.18;
      const z = player.z - rand(TRAFFIC.spawnAheadMin, TRAFFIC.spawnAheadMax);
      this.spawn(z, env.zoneAt(z).zone);
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i];
      // remove: behind the player, too far ahead, or marked
      const behind = v.z - player.z;
      if (v.removeNow || behind > TRAFFIC.despawnBehind + (v.dir < 0 ? 0 : 0) || behind < -TRAFFIC.despawnAhead - 60 || Math.abs(v.x) > WORLD.wallHalfWidth + 3) {
        if (v.removeNow && v.fade > 0.05) { v.fade -= dt * 3; continue; }
        this._release(v); continue;
      }
      this._think(v, dt, player);
    }
  }

  _think(v, dt, player) {
    // wrecks (tipped light vehicles) and out-of-control vehicles
    if (v.tipped) {
      v.throttle = 0; v.brake = 0; v.steer = 0;
      if (v.wreck > 3.2) { v.fade -= dt * 3; if (v.fade <= 0.05) v.removeNow = true; }
      return;
    }
    if (v.stun > 0) { v.throttle = 0; v.brake = 0.15; v.steer = 0; return; }
    if (v.contactTime > 3.2) { v.removeNow = true; return; }

    const fx = v.fx, fz = v.fz, rx = v.rx, rz = v.rz;
    const vf = v.vf;
    // find the closest vehicle ahead in our path
    let gap = 1e9, leaderSpeed = 0;
    const look = 10 + Math.max(0, vf) * 1.7;
    const consider = (o) => {
      if (o === v || !o.active) return;
      const dx = o.x - v.x, dz = o.z - v.z;
      const lon = dx * fx + dz * fz;
      if (lon <= 0 || lon > look + 12) return;
      const lat = Math.abs(dx * rx + dz * rz);
      if (lat > v.halfW + o.halfW + 0.45) return;
      const g = lon - v.halfL - o.halfL;
      if (g < gap) { gap = g; leaderSpeed = o.vx * fx + o.vz * fz; }
    };
    for (const o of this.list) consider(o);
    consider(player);

    let target = v.cruise;
    if (v.dir > 0 && this.jam && v.z < this.jam.z0 + 20 && v.z > this.jam.z1 - 10 && v.lane !== this.jam.freeLane) target = Math.min(target, TRAFFIC.jamSpeed + 1);
    if (gap < 1e8) {
      const safe = TRAFFIC.minGap + Math.max(0, vf) * TRAFFIC.headway;
      if (gap < safe) target = Math.min(target, Math.max(0, leaderSpeed - (safe - gap) * 0.6));
      else target = Math.min(target, leaderSpeed + (gap - safe) * 0.5 + 1);
      if (gap < 2.0 && leaderSpeed < 1) target = 0;
      // impatient honk when stuck behind something slow
      v.honkT -= dt;
      if (gap < 6 && v.honkT <= 0 && this.onHorn && this.hornCooldown <= 0) { v.honkT = rand(4, 10); this.hornCooldown = 1.2; this.onHorn(v); }
    }
    const err = target - vf;
    v.throttle = clamp(err / 2.2, 0, 1);
    v.brake = clamp(-err / 2.5, 0, 1) * (vf > 0.2 ? 1 : 0);

    // lane changes: slow leader ahead, or a random weave
    v.laneTimer -= dt;
    if (v.laneTimer <= 0) {
      v.laneTimer = rand(1.8, 4.5);
      const blocked = gap < 18 && leaderSpeed < v.cruise - 1.5;
      if (blocked || Math.random() < 0.07) this._tryLaneChange(v, blocked);
    }
    // motorcycles / bicycles drift around inside their lane for unpredictability
    if (v.type === 'motorcycle' || v.type === 'bicycle') {
      v.offsetT -= dt;
      if (v.offsetT <= 0) { v.offsetT = rand(1, 3); v.offset = rand(-0.9, 0.9); }
    }
    const laneX = laneCenter(v.dir, v.lane) + v.offset;
    const e = laneX - v.x;
    const base = v.dir > 0 ? 0 : Math.PI;
    const desired = base + (v.dir > 0 ? -1 : 1) * clamp(e * 0.12, -0.34, 0.34);
    const yawErr = angleDiff(v.yaw, desired);
    v.steer = clamp(-yawErr * 2.4, -1, 1);
    // recovery assist: after a hit the body may point somewhere silly - rotate it back gently
    if (Math.abs(yawErr) > 0.9) v.yaw += clamp(yawErr, -1.4 * dt, 1.4 * dt);
    // idle watchdog
    if (Math.abs(vf) < 0.25 && target > 1) { v.idle += dt; if (v.idle > 9) v.removeNow = true; } else v.idle = 0;
  }

  _tryLaneChange(v, preferFaster) {
    const def = v.def;
    const options = [];
    for (const d of [-1, 1]) {
      const l = v.lane + d;
      if (l < 0 || l >= WORLD.laneCount || !def.lanes.includes(l)) continue;
      const x = laneCenter(v.dir, l);
      let free = true;
      for (const o of this.list) {
        if (o === v) continue;
        if (Math.abs(o.x - x) < 2.4 && o.z - v.z > -(8 + o.def.l / 2) && o.z - v.z < 8 + o.def.l / 2 + (v.dir > 0 ? 6 : 0) + 6) { free = false; break; }
        if (Math.abs(o.x - x) < 2.4 && Math.abs(o.z - v.z) < 14) { free = false; break; }
      }
      if (free) options.push(l);
    }
    if (options.length) v.lane = randPick(options);
  }

  /** Remove everything beyond z (used when the player is respawned). */
  nearest(x, z, maxDist) {
    let best = null, bd = maxDist * maxDist;
    for (const v of this.list) { const d = (v.x - x) * (v.x - x) + (v.z - z) * (v.z - z); if (d < bd) { bd = d; best = v; } }
    return best;
  }

  dispose() {
    for (const t of TYPES) for (const v of this.pool[t]) v.mesh.removeFromParent();
    for (const v of this.list) v.mesh.removeFromParent();
    this.list.length = 0;
  }
}
