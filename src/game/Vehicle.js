// Vehicle: a 2D arcade rigid body (x, z, yaw) driven by throttle/brake/steer, with collision spin and a mesh.
// Conventions: forward = -Z at yaw 0. f = (-sin yaw, -cos yaw), right = (cos yaw, -sin yaw).
// Positive yaw turns LEFT (towards -X). input.steer > 0 means "turn right".
import * as THREE from 'three';
import { VEHICLE_TYPES, HANDLING } from '../config/vehicles.js';
import { clamp, damp } from './utils.js';

let NEXT_ID = 1;

export class Vehicle {
  /** @param {string} type key of VEHICLE_TYPES  @param {THREE.Object3D} mesh */
  constructor(type, mesh, def = VEHICLE_TYPES[type]) {
    this.id = NEXT_ID++;
    this.type = type;
    this.def = def;
    this.kind = 'traffic';          // 'player' | 'traffic' | 'police'
    this.mesh = mesh;
    this.h = HANDLING[type] || HANDLING.car;
    this.isStatic = false;
    this.halfW = def.w / 2;
    this.halfL = def.l / 2;
    this.broad = Math.hypot(this.halfW, this.halfL);
    this.setMass(def.mass);
    this.maxSpeed = 15;
    this.accel = this.h.accel;
    this.brakeDecel = this.h.brake;
    this.reverseMax = 5;
    this.steerScale = 1;
    this.reset(0, 0, 0, 0);
  }

  setMass(m) {
    this.mass = m;
    this.invMass = 1 / m;
    this.inertia = (m * (this.halfW * 2 * this.halfW * 2 + this.halfL * 2 * this.halfL * 2)) / 12;
    this.invInertia = 1 / this.inertia;
  }

  reset(x, z, yaw, speed) {
    this.active = true;
    this.x = x; this.z = z; this.yaw = yaw;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    this.vx = -sy * speed; this.vz = -cy * speed;
    this.omega = 0;
    this.vf = speed;
    this.throttle = 0; this.brake = 0; this.steer = 0;
    this.stun = 0;
    this.tipped = false; this.wreck = 0;
    this.roll = 0; this.pitch = 0; this.rollTarget = 0;
    this.longAccel = 0; this.yawRate = 0;
    this.contactTime = 0;
    this.removeNow = false;
    this.fade = 1;
    this.lastImpulse = 0;
    // fields updated by the collision system each frame
    this.rx = Math.cos(yaw); this.rz = -Math.sin(yaw); this.fx = -Math.sin(yaw); this.fz = -Math.cos(yaw);
  }

  get speed() { return Math.hypot(this.vx, this.vz); }
  get ex() { return Math.abs(this.rx) * this.halfW + Math.abs(this.fx) * this.halfL; } // half extent along world X

  /** Prepare axes for SAT. Call after yaw changes. */
  prep() {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    this.rx = c; this.rz = -s; this.fx = -s; this.fz = -c;
  }

  /** Mark as hit. Light vehicles can tip over. */
  applyHit(impulse, dirSign) {
    this.lastImpulse = impulse;
    const dv = impulse / this.mass;
    this.stun = Math.max(this.stun, clamp(0.8 + dv * 0.18, 0.8, 2.6));
    if (this.h.tip > 0 && dv > this.h.tip && !this.tipped) {
      this.tipped = true;
      this.wreck = 0;
      this.rollTarget = (dirSign >= 0 ? 1 : -1) * (1.35 + Math.random() * 0.15);
    }
  }

  /** Integrate one step. */
  step(dt) {
    const h = this.h;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fx = -sy, fz = -cy, rx = cy, rz = -sy;
    let vf = this.vx * fx + this.vz * fz;
    let vl = this.vx * rx + this.vz * rz;
    const prevVf = vf;
    const stunned = this.stun > 0 || this.tipped;
    const vmax = this.maxSpeed;

    if (this.throttle > 0 && !this.tipped) {
      if (vf < -0.5) vf += this.brakeDecel * dt * this.throttle;
      else vf += this.accel * Math.max(0, 1 - Math.pow(Math.max(vf, 0) / vmax, 1.4)) * this.throttle * dt;
    }
    if (this.brake > 0 && !this.tipped) {
      if (vf > 0.4) vf = Math.max(0, vf - this.brakeDecel * this.brake * dt);
      else if (this.throttle <= 0) vf = Math.max(-this.reverseMax, vf - this.accel * 0.5 * this.brake * dt);
    }
    if ((this.throttle <= 0 && this.brake <= 0) || this.tipped) {
      const c = (this.tipped ? 5.5 : 0.7) * dt;
      vf -= clamp(vf, -c, c);
    }
    if (vf > vmax) vf -= (vf - vmax) * Math.min(1, 1.5 * dt);
    vf -= vf * h.drag * dt;
    vl *= Math.exp(-(stunned ? h.stunGrip : h.grip) * dt);

    const av = Math.abs(vf);
    const sf = clamp(av / 4.5, 0, 1) / (1 + (av / h.steerRef) * (av / h.steerRef));
    this.yawRate = this.tipped ? 0 : -this.steer * h.steer * sf * (vf >= 0 ? 1 : -1) * this.steerScale;
    this.yaw += (this.yawRate + this.omega) * dt;
    this.omega *= Math.exp(-(stunned ? h.spinDamp * 0.7 : h.spinDamp * 2.2) * dt);

    const sy2 = Math.sin(this.yaw), cy2 = Math.cos(this.yaw);
    this.fx = -sy2; this.fz = -cy2; this.rx = cy2; this.rz = -sy2;
    this.vx = this.fx * vf + this.rx * vl;
    this.vz = this.fz * vf + this.rz * vl;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.vf = vf;
    this.longAccel = dt > 0 ? (vf - prevVf) / dt : 0;
    if (this.stun > 0) this.stun = Math.max(0, this.stun - dt);
    if (this.tipped) this.wreck += dt;
  }

  /** Update mesh transform + body roll/pitch wobble. */
  syncMesh(dt) {
    const m = this.mesh;
    if (!m) return;
    let rollT = this.rollTarget;
    let pitchT = 0;
    if (!this.tipped) {
      rollT = clamp(-this.yawRate * this.vf * 0.0042, -0.07, 0.07);
      pitchT = clamp(this.longAccel * 0.0032, -0.045, 0.04);
    }
    const k = damp(this.tipped ? 9 : 6, dt);
    this.roll += (rollT - this.roll) * k;
    this.pitch += (pitchT - this.pitch) * k;
    const lift = Math.abs(Math.sin(this.roll)) * this.halfW * 0.95;
    m.position.set(this.x, lift, this.z);
    m.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
    const s = this.fade;
    if (s !== 1) m.scale.setScalar(Math.max(0.001, s)); else if (m.scale.x !== 1) m.scale.setScalar(1);
  }
}

/** Shared material for all vertex-coloured vehicle meshes. */
let _vehicleMat = null;
export function vehicleMaterial() {
  if (!_vehicleMat) _vehicleMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return _vehicleMat;
}
