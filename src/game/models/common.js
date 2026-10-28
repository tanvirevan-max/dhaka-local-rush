// Shared helpers for building procedural vehicle / character geometry.
// Local vehicle space: origin on the ground at the vehicle centre, -Z = forward, +X = right, +Y = up.
import { GeoBuilder } from '../geo.js';

export const SKIN = [0xc68642, 0xb07a4a, 0x9c6a3f, 0x8d5524, 0xd8a06a];
export const HAIR = [0x0e0c0a, 0x1a1410, 0x241c15, 0x2b2118];
export const SHIRT = [0xe74c3c, 0x3498db, 0xf1c40f, 0x27ae60, 0xecf0f1, 0x8e44ad, 0xe67e22, 0x16a085, 0x2c3e50, 0xd35400];
export const LUNGI = [0x2d6a9f, 0x2a7f62, 0x7a3b69, 0x9c5a2b, 0x3b4a6b, 0x8c2f39];
export const TIRE = 0x141414;

export function newBuilder(maxVerts = 6000) { return new GeoBuilder(maxVerts); }

/** Flat dark patch under a vehicle (cheap fake shadow). */
export function shadowPatch(b, w, l) {
  b.floor(-w / 2 - 0.18, w / 2 + 0.18, -l / 2 - 0.25, l / 2 + 0.25, 0.015, 0x1b1b1e);
}

/** Vertical quad on a plane x = const. z0 < z1. dir > 0 faces +X, dir < 0 faces -X. */
export function sideQuad(b, x, y0, y1, z0, z1, dir, hex) {
  if (dir > 0) b.q(x, y0, z1, x, y0, z0, x, y1, z0, x, y1, z1, hex);
  else b.q(x, y0, z0, x, y0, z1, x, y1, z1, x, y1, z0, hex);
}

/** Vertical quad on a plane z = const. x0 < x1. dir > 0 faces +Z (rear), dir < 0 faces -Z (front). */
export function endQuad(b, z, x0, x1, y0, y1, dir, hex) {
  if (dir > 0) b.q(x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z, hex);
  else b.q(x1, y0, z, x0, y0, z, x0, y1, z, x1, y1, z, hex);
}

/** Front-facing slope (windshield / bonnet): low at zf, rising toward zr (zr > zf). */
export function slopeFront(b, xL, xR, zf, y0, zr, y1, hex) {
  b.q(xR, y0, zf, xL, y0, zf, xL, y1, zr, xR, y1, zr, hex);
}

/** Rear-facing slope (rear window): low at zLow (rear), rising toward zHigh (zHigh < zLow). */
export function slopeBack(b, xL, xR, zLow, y0, zHigh, y1, hex) {
  b.q(xL, y0, zLow, xR, y0, zLow, xR, y1, zHigh, xL, y1, zHigh, hex);
}

/** Simple tyre + hub, axis along X. */
export function wheel(b, x, y, z, r, w, seg = 10, hub = 0x9a9a9a) {
  b.cylX(x, y, z, r, w, seg, TIRE, hub);
}

/** Seated / standing low-poly person (used for riders, drivers). */
export function person(b, x, y, z, o = {}) {
  const shirt = o.shirt ?? SHIRT[0];
  const skin = o.skin ?? SKIN[0];
  const hair = o.hair ?? HAIR[0];
  const legs = o.legs ?? 0x2b3140;
  const seated = !!o.seated;
  const s = o.scale ?? 1;
  const lean = o.lean ?? 0; // radians forward lean for torso
  if (seated) {
    b.box(x, y + 0.2 * s, z, 0.34 * s, 0.16 * s, 0.5 * s, legs);                // thighs
    b.box(x, y + 0.04 * s, z - 0.3 * s, 0.3 * s, 0.4 * s, 0.14 * s, legs);       // shins
  } else {
    b.box(x, y + 0.45 * s, z, 0.3 * s, 0.9 * s, 0.2 * s, legs);
  }
  const ty = y + (seated ? 0.62 : 1.18) * s;
  b.box(x, ty, z + (seated ? 0.05 : 0) * s, 0.42 * s, 0.56 * s, 0.24 * s, shirt, { rx: lean });
  b.box(x - 0.27 * s, ty + 0.02 * s, z - 0.1 * s, 0.1 * s, 0.5 * s, 0.12 * s, shirt, { rx: -0.6 });
  b.box(x + 0.27 * s, ty + 0.02 * s, z - 0.1 * s, 0.1 * s, 0.5 * s, 0.12 * s, shirt, { rx: -0.6 });
  const hy = ty + 0.42 * s;
  b.blob(x, hy, z - (lean ? 0.06 : 0), 0.13 * s, 0.15 * s, 0.13 * s, skin, 6, 4);
  if (o.helmet) b.blob(x, hy + 0.04 * s, z, 0.16 * s, 0.14 * s, 0.16 * s, o.helmet, 6, 3);
  else if (o.cap) b.blob(x, hy + 0.07 * s, z, 0.14 * s, 0.08 * s, 0.14 * s, o.cap, 6, 2);
  else b.blob(x, hy + 0.07 * s, z + 0.01 * s, 0.135 * s, 0.09 * s, 0.135 * s, hair, 6, 3);
}
