// Missions: passenger pickups at kerb-side bus stops, route progress through the 5 Dhaka areas, route-complete bonus.
// Pickup rule: roll into the yellow bay on the kerb lane (x < -9.5), slow below 7.5 m/s and hold for 1 s.
import * as THREE from 'three';
import { SCORING, WORLD } from '../config/gameConfig.js';
import { ZONES } from '../config/zones.js';
import { newBuilder, SKIN, SHIRT, LUNGI } from './models/common.js';
import { litePerson } from './scenery/pieces.js';
import { clamp } from './utils.js';

const ROUTE_LENGTH = WORLD.chunkLength * WORLD.zoneChunks * ZONES.length;
const VARIANTS = 4, CAP = 14;

class PassengerPool {
  constructor(scene) {
    this.geos = []; this.meshes = []; this.counts = new Array(VARIANTS).fill(0);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
    this._axis = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < VARIANTS; i++) {
      const b = newBuilder(300);
      litePerson(b, 0, 0, 0, SHIRT[(i * 3 + 2) % SHIRT.length], SKIN[i % SKIN.length], i % 2 ? LUNGI[i % LUNGI.length] : 0x2b3140, 1);
      const g = b.toGeometry();
      const m = new THREE.InstancedMesh(g, this.mat, CAP);
      m.count = 0; m.frustumCulled = false;
      scene.add(m);
      this.geos.push(g); this.meshes.push(m);
    }
  }
  begin() { this.counts.fill(0); }
  add(variant, x, y, z, yaw = 0) {
    const v = variant % VARIANTS;
    if (this.counts[v] >= CAP) return;
    this._q.setFromAxisAngle(this._axis, yaw);
    this._m.compose(this._p.set(x, y, z), this._q, this._s);
    this.meshes[v].setMatrixAt(this.counts[v]++, this._m);
  }
  end() { for (let i = 0; i < VARIANTS; i++) { const m = this.meshes[i]; m.count = this.counts[i]; m.instanceMatrix.needsUpdate = true; } }
  dispose() { for (const m of this.meshes) m.removeFromParent(); for (const g of this.geos) g.dispose(); this.mat.dispose(); }
}

export class MissionManager {
  constructor(scene, env, score, emit = () => {}) {
    this.env = env; this.score = score; this.emit = emit;
    this.pool = new PassengerPool(scene);
    this.boarding = [];
    this.reset(0);
  }

  reset(startZ) {
    this.startZ = startZ;
    this._z = startZ;
    this.routes = 0;
    this.passengers = 0;          // boarded this route
    this.totalPassengers = 0;
    this.lastZoneId = null;
    this.next = null;             // { dist, dwell01 } for the HUD
    this.boarding.length = 0;
    this._announced = new Set();
    this.zone = ZONES[0];
    this.pool.begin(); this.pool.end();
  }

  get routeProgress01() { return clamp(((this.startZ - this._z) % ROUTE_LENGTH) / ROUTE_LENGTH, 0, 1); }

  update(dt, player, repair) {
    this._z = player.z;
    const info = this.env.zoneAt(player.z);
    if (info.zone.id !== this.lastZoneId) {
      this.lastZoneId = info.zone.id;
      this.zone = info.zone;
      this.emit('zone', info);
    }
    this.zoneProgress01 = info.zoneChunk / WORLD.zoneChunks;

    // route completion
    const travelled = this.startZ - player.z;
    if (travelled >= ROUTE_LENGTH * (this.routes + 1)) {
      this.routes++;
      this.score.stats.routes = this.routes;
      this.score.award('route', SCORING.routeComplete.points, { combo: false });
      if (this.passengers >= SCORING.routeComplete.passengerTarget) this.score.award('routeBonus', SCORING.routeComplete.passengerBonus, { combo: false });
      this.passengers = 0;
      this.emit('route', { routes: this.routes });
    }

    // bus stops around the player
    let nearest = null;
    const speed = Math.abs(player.vf);
    this.pool.begin();
    this.env.forEachStop(player.z - 230, player.z + 14, (stop) => {
      const dzAhead = player.z - stop.z;                        // > 0: stop is still ahead of the bus
      if (!stop.served) {
        for (const p of stop.pax) this.pool.add(p.seed, p.x, 0.18 + Math.abs(Math.sin(performance.now() * 0.003 + p.seed)) * 0.03, p.z, Math.PI / 2);
        if (dzAhead > 0) stop.seenAhead = true;
        if (dzAhead > 0 && (!nearest || dzAhead < nearest.dist)) nearest = { dist: dzAhead, stop };
        if (dzAhead > 0 && dzAhead < 85 && !this._announced.has(stop)) { this._announced.add(stop); this.emit('stopApproach', stop); }
        const inBay = Math.abs(dzAhead) < 6.5 && player.x < -9.4;
        if (inBay && speed < SCORING.pickup.maxSpeed) {
          stop.dwell = (stop.dwell || 0) + dt;
          if (stop.dwell === dt) this.emit('boardStart', stop);
          if (stop.dwell >= SCORING.pickup.dwellSeconds) this._serve(stop, player, repair);
        } else stop.dwell = Math.max(0, (stop.dwell || 0) - dt * 0.6);
        if (dzAhead < -9 && !stop.missed) { stop.missed = true; if (stop.seenAhead) this.emit('stopMissed', stop); }
      }
    });
    this.next = nearest ? { dist: nearest.dist, dwell01: clamp((nearest.stop.dwell || 0) / SCORING.pickup.dwellSeconds, 0, 1), stop: nearest.stop } : null;

    // boarding animation: passengers walk to the door and vanish
    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    const doorX = player.x + -1.5 * cy + -3.7 * sy, doorZ = player.z - -1.5 * sy + -3.7 * cy;
    for (let i = this.boarding.length - 1; i >= 0; i--) {
      const b = this.boarding[i];
      const dx = doorX - b.x, dz = doorZ - b.z, d = Math.hypot(dx, dz);
      if (d < 0.7) { this.boarding.splice(i, 1); continue; }
      const step = Math.min(d, 3.2 * dt);
      b.x += (dx / d) * step; b.z += (dz / d) * step;
      this.pool.add(b.seed, b.x, 0.18, b.z, Math.atan2(-dx, -dz) + Math.PI);
    }
    this.pool.end();
  }

  _serve(stop, player, repair) {
    stop.served = true;
    const n = stop.pax.length;
    const pts = SCORING.pickup.points + (n - SCORING.pickup.passengersMin) * 40;
    this.passengers += n; this.totalPassengers += n;
    this.score.stats.passengers += n;
    this.score.award('pickup', pts, { extra: n });
    for (const p of stop.pax) this.boarding.push({ x: p.x, z: p.z, seed: p.seed });
    if (repair) repair(SCORING.pickup.repair);
    this.emit('pickup', { stop, n });
  }

  dispose() { this.pool.dispose(); }
}

export { ROUTE_LENGTH };
