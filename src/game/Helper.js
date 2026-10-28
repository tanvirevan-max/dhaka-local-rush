// The bus helper ("হেল্পার") hanging off the front-left door of the player's bus.
// A low-poly articulated character (merged body mesh + two IK arms + animated mouth). The whole rig is a child of the
// bus group, standing on the lower footboard, so it can never drift away from the vehicle.
//  - right hand is IK-locked onto the chrome door pole
//  - left arm performs gestures: calling passengers, pointing, cheering, flinching
import * as THREE from 'three';
import { newBuilder, SKIN, HAIR, SHIRT } from './models/common.js';
import { clamp, damp } from './utils.js';

const UP_ARM = 0.3, FORE_ARM = 0.3;
const SHOULDER_Y = 1.4, SHOULDER_X = 0.26;

function buildBody(shirt, skin, hair) {
  const b = newBuilder(1800);
  const trousers = 0x2a3350, shoe = 0x1b1b1b, gamchaRed = 0xc0392b, gamchaWhite = 0xf4f0e6;
  // legs + sandals
  for (const sx of [-1, 1]) {
    b.box(sx * 0.12, 0.45, 0, 0.16, 0.86, 0.19, trousers, { g0: 0.8, g1: 1 });
    b.box(sx * 0.12, 0.04, -0.05, 0.19, 0.08, 0.32, shoe);
  }
  // belt + hips
  b.box(0, 0.88, 0, 0.4, 0.1, 0.23, 0x3a2a1c);
  // torso (shirt with stripes) + open collar
  b.box(0, 1.18, 0, 0.46, 0.62, 0.25, shirt);
  for (let i = 0; i < 3; i++) b.box(0, 0.98 + i * 0.2, -0.002, 0.465, 0.05, 0.255, 0xffffff, { f: 63 });
  b.box(0, 1.42, -0.115, 0.14, 0.12, 0.03, skin);
  // neck + head
  b.box(0, 1.52, 0, 0.11, 0.1, 0.11, skin);
  b.blob(0, 1.69, 0, 0.13, 0.155, 0.135, skin, 7, 5);
  b.blob(0, 1.76, 0.015, 0.138, 0.1, 0.14, hair, 7, 3);
  // gamcha (checked scarf) as headband + tail over the shoulder
  b.box(0, 1.755, -0.01, 0.285, 0.05, 0.285, gamchaRed);
  b.box(0.08, 1.755, -0.012, 0.06, 0.052, 0.287, gamchaWhite);
  b.box(-0.08, 1.755, -0.012, 0.06, 0.052, 0.287, gamchaWhite);
  b.box(0.2, 1.3, 0.08, 0.08, 0.34, 0.05, gamchaRed, { rz: -0.15 });
  // face: eyes + nose + ears
  b.box(-0.05, 1.7, -0.128, 0.03, 0.025, 0.012, 0x111111);
  b.box(0.05, 1.7, -0.128, 0.03, 0.025, 0.012, 0x111111);
  b.box(0, 1.665, -0.14, 0.03, 0.05, 0.03, skin);
  b.box(-0.135, 1.68, 0, 0.03, 0.07, 0.04, skin);
  b.box(0.135, 1.68, 0, 0.03, 0.07, 0.04, skin);
  return b.toGeometry();
}

function buildArm(shirt, skin) {
  const up = newBuilder(300), fore = newBuilder(400);
  up.box(0, -UP_ARM / 2, 0, 0.115, UP_ARM, 0.115, shirt, { f: 63 });
  up.blob(0, 0, 0, 0.07, 0.07, 0.07, shirt, 5, 3);
  fore.box(0, -FORE_ARM / 2 + 0.01, 0, 0.09, FORE_ARM - 0.04, 0.09, skin, { f: 63 });
  fore.blob(0, -FORE_ARM, 0, 0.058, 0.07, 0.058, skin, 5, 4);
  return { up: up.toGeometry(), fore: fore.toGeometry() };
}

export class Helper {
  /**
   * @param {{w:number,l:number,doorZ0:number,doorZ1:number}} dims bus dimensions from buildBusGeometry
   * @param {number} seed picks the helper's shirt / skin / hair
   */
  constructor(dims, seed = 0) {
    this.group = new THREE.Group();
    const hw = dims.w / 2;
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const shirt = SHIRT[(seed * 3 + 1) % SHIRT.length], skin = SKIN[(seed + 1) % SKIN.length], hair = HAIR[seed % HAIR.length];

    // root stands on the lower footboard (top surface y = 0.54), beside the front door pole
    const poleX = -hw + 0.01, poleZ = dims.doorZ0 + 0.03, poleY = 1.88;
    this.root = new THREE.Group();
    this.root.position.set(-hw - 0.2, 0.54, poleZ + 0.56);
    this.group.add(this.root);
    this.pelvis = new THREE.Group();
    this.pelvis.rotation.order = 'ZXY';
    this.root.add(this.pelvis);
    // grip point in root space
    this.grip = new THREE.Vector3(poleX - this.root.position.x, poleY - this.root.position.y, poleZ - this.root.position.z);

    this.body = new THREE.Mesh(buildBody(shirt, skin, hair), this.mat);
    this.pelvis.add(this.body);

    // mouth (animated)
    this.mouth = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.022, 0.02), new THREE.MeshBasicMaterial({ color: 0x3a0f0f }));
    this.mouth.position.set(0, 1.628, -0.138);
    this.pelvis.add(this.mouth);

    const arm = buildArm(shirt, skin);
    this.arms = [];
    for (const side of [1, -1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * SHOULDER_X, SHOULDER_Y, 0);
      const upper = new THREE.Mesh(arm.up, this.mat);
      const elbow = new THREE.Group();
      elbow.position.set(0, -UP_ARM, 0);
      const lower = new THREE.Mesh(arm.fore, this.mat);
      elbow.add(lower);
      shoulder.add(upper, elbow);
      this.pelvis.add(shoulder);
      this.arms.push({ shoulder, elbow, side });
    }
    this.armR = this.arms[0];
    this.armL = this.arms[1];
    this._geoms = [this.body.geometry, arm.up, arm.fore, this.mouth.geometry];

    // animation state
    this.time = Math.random() * 10;
    this.gestureName = 'idle';
    this.gestureTime = 0;
    this.nextAuto = 2 + Math.random() * 3;
    this.talkTimer = 0;
    this.flinch = 0;
    this.leftTarget = new THREE.Vector3(-0.4, 1.0, -0.1);
    this._t = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._hint = new THREE.Vector3();
    this._perp = new THREE.Vector3();
    this._qa = new THREE.Quaternion();
    this._qb = new THREE.Quaternion();
    this._m = new THREE.Matrix4();
    this._down = new THREE.Vector3(0, -1, 0);
    this._lean = 0.14;
  }

  /** Start a gesture: 'call' | 'point' | 'cheer' | 'flinch' | 'idle' */
  gesture(name, seconds = 2) {
    this.gestureName = name;
    this.gestureTime = seconds;
    if (name === 'flinch') this.flinch = 1;
  }

  talk(seconds = 1.5) { this.talkTimer = Math.max(this.talkTimer, seconds); }

  /** Desired left-hand position (pelvis space) for the current gesture. */
  _leftGoal(out, t) {
    switch (this.gestureName) {
      case 'call': return out.set(-0.48 + Math.cos(t * 9) * 0.1, 1.98 + Math.sin(t * 9) * 0.1, -0.22);
      case 'point': return out.set(-0.18, 1.52, -0.6);
      case 'cheer': return out.set(-0.34, 2.12 + Math.abs(Math.sin(t * 8)) * 0.08, -0.04);
      case 'flinch': return out.set(-0.12, 1.28, -0.3);
      default: return out.set(-0.38 + Math.sin(t * 1.3) * 0.02, 1.02 + Math.sin(t * 2.1) * 0.02, -0.08);
    }
  }

  /** Two-bone IK: aim an arm so the hand reaches `target` (pelvis space). */
  _ik(arm, target, hint) {
    const S = arm.shoulder.position;
    const d = this._d.copy(target).sub(S);
    let len = d.length();
    const reach = UP_ARM + FORE_ARM - 0.02;
    if (len > reach) { d.multiplyScalar(reach / len); len = reach; }
    if (len < 0.12) { len = 0.12; if (d.lengthSq() < 1e-6) d.set(0, -1, 0); }
    d.normalize();
    const cosA = clamp(len / (2 * UP_ARM), -1, 1);
    const alpha = Math.acos(cosA), sinA = Math.sin(alpha);
    const perp = this._perp.copy(hint);
    perp.addScaledVector(d, -perp.dot(d));
    if (perp.lengthSq() < 1e-6) perp.set(0, -1, 0);
    perp.normalize();
    // upper arm direction
    const upper = this._t.copy(d).multiplyScalar(cosA).addScaledVector(perp, sinA).normalize();
    this._qa.setFromUnitVectors(this._down, upper);
    arm.shoulder.quaternion.copy(this._qa);
    // forearm direction: from elbow to hand
    const hand = this._hint.copy(d).multiplyScalar(len);              // hand relative to shoulder
    const elbowPos = this._d.copy(upper).multiplyScalar(UP_ARM);       // elbow relative to shoulder
    hand.sub(elbowPos).normalize();                                    // forearm direction
    this._qb.setFromUnitVectors(this._down, hand);
    this._qa.invert();
    arm.elbow.quaternion.copy(this._qa.multiply(this._qb));
  }

  /**
   * @param {number} dt
   * @param {{speed:number,yawRate:number,longAccel:number,boosting:boolean}} s bus state
   */
  update(dt, s) {
    this.time += dt;
    const t = this.time;
    // auto gestures: every few seconds the helper calls out for passengers
    this.gestureTime -= dt;
    if (this.gestureTime <= 0) {
      if (this.gestureName === 'idle') {
        this.nextAuto -= dt;
        if (this.nextAuto <= 0 && s.speed > 3) { this.gestureName = 'call'; this.gestureTime = 2.2 + Math.random() * 1.5; this.talkTimer = Math.max(this.talkTimer, this.gestureTime * 0.8); this.nextAuto = 4 + Math.random() * 5; }
      } else { this.gestureName = 'idle'; }
    }

    // lean: outward by default, buffeted by turns, braking and speed
    const sp = clamp(s.speed / 30, 0, 1.3);
    let lean = 0.12 + sp * 0.06 + (s.boosting ? 0.07 : 0) - clamp(s.yawRate * s.speed * 0.012, -0.1, 0.1);
    if (this.gestureName === 'call') lean += 0.06;
    if (this.flinch > 0) { lean = -0.06; this.flinch = Math.max(0, this.flinch - dt * 1.2); }
    lean += Math.sin(t * 2.3) * 0.015 * (0.4 + sp) + Math.sin(t * 17) * 0.006 * sp;
    this._lean += (lean - this._lean) * damp(8, dt);
    const fwd = clamp(s.longAccel * 0.011, -0.16, 0.14);
    this.pelvis.rotation.set(fwd, 0, this._lean);
    this.pelvis.position.y = -Math.abs(Math.sin(t * 9)) * 0.012 * sp - this.flinch * 0.12;

    // grip target in pelvis space (undo the lean)
    this.pelvis.updateMatrix();
    this._m.copy(this.pelvis.matrix).invert();
    const target = this._t.copy(this.grip).applyMatrix4(this._m);
    this._hint.set(0.25, -1, 0.7);
    this._ik(this.armR, target, this._hint);

    // left arm gesture
    this._leftGoal(target, t);
    this.leftTarget.lerp(target, damp(11, dt));
    this._hint.set(-0.6, -1, 0.5);
    this._ik(this.armL, this.leftTarget, this._hint);

    // mouth
    if (this.talkTimer > 0) {
      this.talkTimer -= dt;
      this.mouth.scale.y = 0.6 + Math.abs(Math.sin(t * 17)) * 2.6;
    } else this.mouth.scale.y = 0.5;
  }

  dispose() {
    for (const g of this._geoms) g.dispose();
    this.mat.dispose();
    this.mouth.material.dispose();
  }
}
