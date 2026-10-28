// Collision detection + response for oriented-box vehicles (2D SAT) with impulse-based resolution.
// - vehicle vs vehicle: mass/inertia aware impulses with friction, so heavy buses shove light vehicles aside
// - vehicle vs static obstacles (median pillars): infinite mass
// - vehicle vs invisible road-side walls
// Events are collected in `this.events` (reused objects) and consumed by Game each frame.
import { WORLD } from '../config/gameConfig.js';
import { clamp } from './utils.js';

const RESTITUTION = 0.22;
const FRICTION = 0.3;
const MIN_EVENT_IMPULSE = 350;
const MAX_CORRECTION = 0.7;

class StaticBody {
  constructor() {
    this.isStatic = true; this.active = true; this.kind = 'static';
    this.x = 0; this.z = 0; this.vx = 0; this.vz = 0; this.omega = 0;
    this.invMass = 0; this.invInertia = 0; this.mass = 1e9;
    this.halfW = 1; this.halfL = 1; this.rx = 1; this.rz = 0; this.fx = 0; this.fz = -1; this.yaw = 0;
    this.stun = 0; this.fade = 1;
  }
  set(x, z, hw, hl) { this.x = x; this.z = z; this.halfW = hw; this.halfL = hl; return this; }
}

const sat = { depth: 0, nx: 0, nz: 0 };
const cp = { x: 0, z: 0 };

/** Separating-axis test for two oriented rectangles. Normal points from A to B. */
function satBoxes(A, B) {
  const dx = B.x - A.x, dz = B.z - A.z;
  let best = Infinity, bnx = 0, bnz = 0;
  for (let k = 0; k < 4; k++) {
    let ax, az;
    if (k === 0) { ax = A.rx; az = A.rz; } else if (k === 1) { ax = A.fx; az = A.fz; }
    else if (k === 2) { ax = B.rx; az = B.rz; } else { ax = B.fx; az = B.fz; }
    const rA = A.halfW * Math.abs(ax * A.rx + az * A.rz) + A.halfL * Math.abs(ax * A.fx + az * A.fz);
    const rB = B.halfW * Math.abs(ax * B.rx + az * B.rz) + B.halfL * Math.abs(ax * B.fx + az * B.fz);
    const d = dx * ax + dz * az;
    const overlap = rA + rB - Math.abs(d);
    if (overlap <= 0) return false;
    if (overlap < best) { best = overlap; const s = d < 0 ? -1 : 1; bnx = ax * s; bnz = az * s; }
  }
  sat.depth = best; sat.nx = bnx; sat.nz = bnz;
  return true;
}

function inside(B, px, pz) {
  const dx = px - B.x, dz = pz - B.z;
  return Math.abs(dx * B.rx + dz * B.rz) <= B.halfW + 0.06 && Math.abs(dx * B.fx + dz * B.fz) <= B.halfL + 0.06;
}

/** Approximate contact point: mean of the corners of each box that lie inside the other. */
function contactPoint(A, B) {
  let sx = 0, sz = 0, n = 0;
  for (let i = 0; i < 8; i++) {
    const body = i < 4 ? A : B, other = i < 4 ? B : A;
    const s1 = i & 1 ? 1 : -1, s2 = i & 2 ? 1 : -1;
    const px = body.x + body.rx * body.halfW * s1 + body.fx * body.halfL * s2;
    const pz = body.z + body.rz * body.halfW * s1 + body.fz * body.halfL * s2;
    if (inside(other, px, pz)) { sx += px; sz += pz; n++; }
  }
  if (n === 0) { cp.x = (A.x + B.x) / 2; cp.z = (A.z + B.z) / 2; } else { cp.x = sx / n; cp.z = sz / n; }
}

/** Apply impulse + positional correction. Returns { j, closing }. */
const res = { j: 0, closing: 0 };
function resolve(A, B, nx, nz, depth) {
  const rAx = cp.x - A.x, rAz = cp.z - A.z, rBx = cp.x - B.x, rBz = cp.z - B.z;
  const vAx = A.vx + A.omega * rAz, vAz = A.vz - A.omega * rAx;
  const vBx = B.vx + B.omega * rBz, vBz = B.vz - B.omega * rBx;
  const rvx = vBx - vAx, rvz = vBz - vAz;
  const vn = rvx * nx + rvz * nz;
  let j = 0;
  res.closing = 0;
  if (vn < 0) {
    const raxn = rAz * nx - rAx * nz, rbxn = rBz * nx - rBx * nz;
    const denom = A.invMass + B.invMass + raxn * raxn * A.invInertia + rbxn * rbxn * B.invInertia;
    j = (-(1 + RESTITUTION) * vn) / denom;
    A.vx -= j * nx * A.invMass; A.vz -= j * nz * A.invMass; A.omega -= A.invInertia * raxn * j;
    B.vx += j * nx * B.invMass; B.vz += j * nz * B.invMass; B.omega += B.invInertia * rbxn * j;
    res.closing = -vn;
    // Coulomb friction along the tangent (gives side-swipes their spin and drag)
    const tx = -nz, tz = nx;
    const vt = rvx * tx + rvz * tz;
    const ratn = rAz * tx - rAx * tz, rbtn = rBz * tx - rBx * tz;
    const denomT = A.invMass + B.invMass + ratn * ratn * A.invInertia + rbtn * rbtn * B.invInertia;
    const jt = clamp(-vt / denomT, -FRICTION * j, FRICTION * j);
    A.vx -= jt * tx * A.invMass; A.vz -= jt * tz * A.invMass; A.omega -= A.invInertia * ratn * jt;
    B.vx += jt * tx * B.invMass; B.vz += jt * tz * B.invMass; B.omega += B.invInertia * rbtn * jt;
  }
  const invSum = A.invMass + B.invMass;
  if (invSum > 0) {
    const corr = (Math.max(depth - 0.02, 0) * 0.85) / invSum;
    const ca = Math.min(MAX_CORRECTION, corr * A.invMass), cb = Math.min(MAX_CORRECTION, corr * B.invMass);
    A.x -= nx * ca; A.z -= nz * ca;
    B.x += nx * cb; B.z += nz * cb;
  }
  res.j = j;
  return j;
}

export class CollisionManager {
  constructor() {
    this.events = [];
    this._pool = [];
    this._used = 0;
    this._statics = Array.from({ length: 24 }, () => new StaticBody());
  }

  _event(type, a, b, impulse, closing, px, pz, nx, nz) {
    let e = this._pool[this._used];
    if (!e) { e = {}; this._pool[this._used] = e; }
    this._used++;
    e.type = type; e.a = a; e.b = b; e.impulse = impulse; e.closing = closing;
    e.px = px; e.pz = pz; e.nx = nx; e.nz = nz;
    this.events.push(e);
  }

  /**
   * @param {number} dt
   * @param {Vehicle[]} bodies active vehicles (player + traffic + police)
   * @param {{queryObstacles:(z0:number,z1:number,cb:(x:number,z:number,hw:number,hl:number)=>void)=>void}} env
   */
  update(dt, bodies, env) {
    this.events.length = 0;
    this._used = 0;
    const n = bodies.length;
    for (let i = 0; i < n; i++) { const b = bodies[i]; b.prep(); b._touch = false; }

    for (let pass = 0; pass < 2; pass++) {
      const report = pass === 0;
      // dynamic vs dynamic
      for (let i = 0; i < n; i++) {
        const A = bodies[i];
        if (!A.active) continue;
        for (let j = i + 1; j < n; j++) {
          const B = bodies[j];
          if (!B.active) continue;
          const dx = B.x - A.x, dz = B.z - A.z, rr = A.broad + B.broad;
          if (dx * dx + dz * dz > rr * rr) continue;
          if (!satBoxes(A, B)) continue;
          A._touch = true; B._touch = true;
          const nx = sat.nx, nz = sat.nz, depth = sat.depth;
          contactPoint(A, B);
          const j0 = resolve(A, B, nx, nz, depth);
          if (report && j0 > MIN_EVENT_IMPULSE) this._event('hit', A, B, j0, res.closing, cp.x, cp.z, nx, nz);
        }
      }
      // dynamic vs static obstacles (median pillars, etc.)
      let sIdx = 0;
      for (let i = 0; i < n; i++) {
        const A = bodies[i];
        if (!A.active || Math.abs(A.x) > 6) continue; // obstacles live in/near the median
        sIdx = 0;
        env.queryObstacles(A.z - A.broad - 1, A.z + A.broad + 1, (ox, oz, hw, hl) => {
          if (sIdx >= this._statics.length) return;
          const S = this._statics[sIdx++].set(ox, oz, hw, hl);
          const dx = S.x - A.x, dz = S.z - A.z, rr = A.broad + Math.hypot(hw, hl);
          if (dx * dx + dz * dz > rr * rr) return;
          if (!satBoxes(A, S)) return;
          A._touch = true;
          const nx = sat.nx, nz = sat.nz, depth = sat.depth;
          contactPoint(A, S);
          const j0 = resolve(A, S, nx, nz, depth);
          if (report && j0 > MIN_EVENT_IMPULSE) this._event('static', A, null, j0, res.closing, cp.x, cp.z, nx, nz);
        });
      }
    }

    // road-side walls
    const wall = WORLD.wallHalfWidth;
    for (let i = 0; i < n; i++) {
      const A = bodies[i];
      if (!A.active) continue;
      const ex = A.ex;
      if (A.x - ex < -wall) {
        const impact = Math.max(0, -A.vx);
        A.x = -wall + ex;
        if (A.vx < 0) A.vx = -A.vx * 0.12;
        if (impact > 0.6) this._event('wall', A, null, A.mass * impact * 0.35, impact, -wall, A.z, 1, 0);
      } else if (A.x + ex > wall) {
        const impact = Math.max(0, A.vx);
        A.x = wall - ex;
        if (A.vx > 0) A.vx = -A.vx * 0.12;
        if (impact > 0.6) this._event('wall', A, null, A.mass * impact * 0.35, impact, wall, A.z, -1, 0);
      }
    }

    // stuck watchdog: sustained contact for non-player bodies
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (b.kind === 'player') continue;
      b.contactTime = b._touch ? b.contactTime + dt : 0;
    }
  }
}
