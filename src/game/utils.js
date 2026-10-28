// Small math / random helpers shared by all game modules.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v < 0 ? -1 : 1);

// Frame-rate independent smoothing factor: value += (target - value) * damp(k, dt)
export const damp = (k, dt) => 1 - Math.exp(-k * dt);

// Smallest signed difference between two angles (radians).
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Deterministic PRNG so a chunk always generates the same scenery.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed = 1) { this.next = mulberry32(seed); }
  f() { return this.next(); }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(a + (b - a + 1) * this.next()); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  pickWeighted(items, weightFn) {
    let total = 0;
    for (const it of items) total += weightFn(it);
    let r = this.next() * total;
    for (const it of items) { r -= weightFn(it); if (r <= 0) return it; }
    return items[items.length - 1];
  }
}

// Shared non-seeded random (gameplay randomness).
export const rand = (a = 0, b = 1) => a + (b - a) * Math.random();
export const randPick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const randSign = () => (Math.random() < 0.5 ? -1 : 1);

// Bangla digits for the HUD
const BN = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export const toBn = (n) => String(n).replace(/[0-9]/g, (d) => BN[d]);

export function fmtScore(n) { return Math.max(0, Math.round(n)).toLocaleString('en-US'); }

export function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Detect weaker devices so we can pick a cheaper rendering path.
export function isLowEndDevice() {
  const nav = navigator;
  const mem = nav.deviceMemory || 4;
  const cores = nav.hardwareConcurrency || 4;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent) || (nav.maxTouchPoints > 1 && window.innerWidth < 1100);
  return mobile && (mem <= 4 || cores <= 6);
}

export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
