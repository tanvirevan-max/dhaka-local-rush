// Pooled particle system (sparks, dust, exhaust smoke, boost flame). One draw call, zero per-frame allocation.
import * as THREE from 'three';

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(1.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
precision mediump float;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = dot(p, p) * 4.0;
  if (d > 1.0) discard;
  float a = (1.0 - d) * vAlpha;
  gl_FragColor = vec4(vColor, a);
}`;

export class Effects {
  constructor(scene, capacity = 220) {
    this.n = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.s0 = new Float32Array(capacity);
    this.s1 = new Float32Array(capacity);
    this.a0 = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.cursor = 0;
    this.scaleUniform = { value: 600 };

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.geometry = g;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      uniforms: { uScale: this.scaleUniform },
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    for (let i = 0; i < capacity; i++) { this.pos[i * 3 + 1] = -100; this.life[i] = 0; }
    this._c = new THREE.Color();
  }

  /** Call on resize so point sizes stay proportional to the screen height. */
  setViewport(heightPx, fovDeg) {
    this.scaleUniform.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  emit(x, y, z, vx, vy, vz, life, size0, size1, hex, alpha = 0.9, gravity = 0, drag = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.n;
    const o3 = i * 3;
    this.pos[o3] = x; this.pos[o3 + 1] = y; this.pos[o3 + 2] = z;
    this.vel[o3] = vx; this.vel[o3 + 1] = vy; this.vel[o3 + 2] = vz;
    this._c.setHex(hex);
    this.col[o3] = this._c.r; this.col[o3 + 1] = this._c.g; this.col[o3 + 2] = this._c.b;
    this.life[i] = life; this.maxLife[i] = life;
    this.s0[i] = size0; this.s1[i] = size1; this.a0[i] = alpha;
    this.grav[i] = gravity; this.drag[i] = drag;
    this.size[i] = size0; this.alpha[i] = alpha;
  }

  sparks(x, y, z, count, power = 6) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, up = 1 + Math.random() * 3;
      const s = power * (0.4 + Math.random() * 0.8);
      this.emit(x, y, z, Math.cos(a) * s, up * power * 0.35, Math.sin(a) * s, 0.35 + Math.random() * 0.35, 0.35, 0.08,
        Math.random() < 0.5 ? 0xffc14d : 0xff7a1a, 1, -14, 0.4);
    }
  }

  dust(x, y, z, count, power = 3, hex = 0xb9ad98) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, s = power * (0.3 + Math.random() * 0.7);
      this.emit(x, y, z, Math.cos(a) * s, 0.6 + Math.random() * 1.2, Math.sin(a) * s, 0.7 + Math.random() * 0.6, 0.9, 3.2, hex, 0.55, 0.5, 1.6);
    }
  }

  smoke(x, y, z, vx, vz, hex = 0x55524e, alpha = 0.45) {
    this.emit(x, y, z, vx + (Math.random() - 0.5) * 0.5, 0.8 + Math.random() * 0.6, vz + (Math.random() - 0.5) * 0.5, 0.9 + Math.random() * 0.4, 0.5, 2.4, hex, alpha, 0, 0.8);
  }

  flame(x, y, z, vx, vz) {
    this.emit(x, y, z, vx + (Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 0.5, vz + (Math.random() - 0.5) * 0.8, 0.22 + Math.random() * 0.15, 0.7, 0.15, Math.random() < 0.5 ? 0xffb347 : 0x66b3ff, 0.85, 0, 1.0);
  }

  /** Kill every particle (new run). */
  clear() {
    for (let i = 0; i < this.n; i++) { this.life[i] = 0; this.alpha[i] = 0; this.pos[i * 3 + 1] = -100; }
  }

  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const o3 = i * 3;
      if (this.life[i] <= 0) { this.pos[o3 + 1] = -100; this.alpha[i] = 0; continue; }
      const t = 1 - this.life[i] / this.maxLife[i];
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[o3] *= k; this.vel[o3 + 2] *= k;
      this.vel[o3 + 1] = this.vel[o3 + 1] * k + this.grav[i] * dt;
      this.pos[o3] += this.vel[o3] * dt;
      this.pos[o3 + 1] = Math.max(0.05, this.pos[o3 + 1] + this.vel[o3 + 1] * dt);
      this.pos[o3 + 2] += this.vel[o3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.alpha[i] = this.a0[i] * (1 - t) * (1 - t * 0.3);
    }
    const a = this.geometry.attributes;
    a.position.needsUpdate = true; a.aSize.needsUpdate = true; a.aAlpha.needsUpdate = true; a.aColor.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose(); this.material.dispose(); this.points.removeFromParent();
  }
}
