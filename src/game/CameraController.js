// Smooth third-person chase camera with a small delay, collision shake and boost FOV feedback.
import * as THREE from 'three';
import { CAMERA } from '../config/gameConfig.js';
import { damp, angleDiff, clamp } from './utils.js';

export class CameraController {
  constructor(aspect = 16 / 9) {
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, aspect, 0.8, 700);
    this.yaw = 0;
    this.pos = new THREE.Vector3(0, 6, 20);
    this.look = new THREE.Vector3(0, 1.5, 0);
    this.fov = CAMERA.fov;
    this.shake = 0;
    this.shakeEnabled = true;
    this.time = 0;
    this._tmp = new THREE.Vector3();
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    // narrow portrait screens: widen the vertical FOV a little so the road ahead stays visible
    this.baseFov = aspect < 0.8 ? CAMERA.fov + 10 : aspect < 1.2 ? CAMERA.fov + 4 : CAMERA.fov;
    this.camera.updateProjectionMatrix();
  }

  addShake(amount) { this.shake = Math.min(1.4, this.shake + amount); }

  /** Snap straight behind the target (new run). */
  snap(target) {
    this.yaw = target.yaw;
    this.placeDesired(target, this.pos, this.look);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  placeDesired(t, outPos, outLook) {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const speedK = clamp(t.speed / 30, 0, 1.3);
    const dist = CAMERA.distance + speedK * 1.4 + (t.boosting ? 1.6 : 0);
    const lateral = -1.15; // sit a little to the left so the door helper stays in view
    outPos.set(t.x - fx * dist + rx * lateral, CAMERA.height + speedK * 0.35, t.z - fz * dist + rz * lateral);
    outLook.set(t.x + fx * (CAMERA.lookAhead + speedK * 5) + rx * lateral * 0.35, 1.7, t.z + fz * (CAMERA.lookAhead + speedK * 5) + rz * lateral * 0.35);
  }

  /** t = { x, z, yaw, speed, boosting } */
  update(dt, t) {
    this.time += dt;
    // heading follows with a lag; big spin-outs are followed more slowly so the view never whips around
    const d = angleDiff(this.yaw, t.yaw);
    this.yaw += d * damp(3.2, dt);
    const desiredPos = this._tmp;
    const desiredLook = this.look;
    this.placeDesired(t, desiredPos, desiredLook);
    const k = damp(7.5, dt);
    this.pos.lerp(desiredPos, k);

    this.fov += ((this.baseFov || CAMERA.fov) + (t.boosting ? 12 : 0) + clamp(t.speed / 40, 0, 1) * 4 - this.fov) * damp(4, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }

    this.camera.position.copy(this.pos);
    if (this.shakeEnabled && this.shake > 0.001) {
      const s = this.shake * this.shake;
      const tt = this.time * 55;
      this.camera.position.x += Math.sin(tt * 1.3) * 0.28 * s;
      this.camera.position.y += Math.cos(tt * 1.7) * 0.22 * s;
      this.camera.position.z += Math.sin(tt * 0.9 + 1.2) * 0.2 * s;
    }
    // boost adds a faint continuous rumble
    if (this.shakeEnabled && t.boosting) {
      const tt = this.time * 40;
      this.camera.position.x += Math.sin(tt) * 0.025;
      this.camera.position.y += Math.cos(tt * 1.3) * 0.02;
    }
    this.shake = Math.max(0, this.shake - CAMERA.shakeDecay * dt * 0.35 - this.shake * dt * 2.2);
    this.camera.lookAt(this.look);
  }
}
