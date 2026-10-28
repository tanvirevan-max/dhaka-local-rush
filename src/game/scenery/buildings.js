// Building generators. A "segment" is the z-range [zB, zA] (zA > zB) along one side of the road; widths are multiples of 3 m
// so the 3 m window tiles of the facade texture line up with building edges.
import { F, shade, mixHex } from '../geo.js';
import { sideQuad } from '../models/common.js';
import { SIGN } from '../../config/signs.js';
import { WALK_OUT, WALK_Y, pedestrian, parkedVehicle, tree, signFace, billboard, tinCanopy } from './pieces.js';
import { getDetail } from './detail.js';

const SHUTTER = [0x7f8c8d, 0x5d6d7e, 0x8e5a3c, 0x3e7c6b, 0x9a6d38, 0x6b7a8f, 0x944c4c];
const AWNING = [0xe63946, 0x2a9d8f, 0xf4a261, 0x4361ee, 0xffb703, 0x8338ec, 0xe76f51];
const CRATE = [0xe63946, 0xf9c74f, 0x90be6d, 0xf8961e, 0x577590, 0xc77dff];

const faceMask = (side) => F.PY | F.PZ | F.NZ | (side < 0 ? F.PX : F.NX);
const wallMask = (side) => F.PZ | F.NZ | (side < 0 ? F.PX : F.NX);

/** Tiled-facade box (windows) between y0..y1. The roof is drawn separately in the solid layer. */
export function facadeBox(L, side, xNear, depth, zA, zB, y0, y1, hex, glass = false) {
  const b = glass ? L.glass : L.facade;
  b.box(side * (xNear + depth / 2), (y0 + y1) / 2, (zA + zB) / 2, depth, y1 - y0, zA - zB, hex, { f: wallMask(side), facade: [3, 3.2], g0: y0 < 0.1 ? 0.82 : 1, g1: 1 });
}

export function roofSlab(L, side, xNear, depth, zA, zB, y, hex) {
  L.solid.box(side * (xNear + depth / 2), y + 0.1, (zA + zB) / 2, depth + 0.1, 0.2, zA - zB + 0.1, hex, { f: F.PY | F.PZ | F.NZ | F.PX | F.NX });
}

function rooftop(L, rng, side, xNear, depth, zA, zB, y, zone) {
  const S = L.solid, cx = side * (xNear + depth * rng.range(0.3, 0.7)), len = zA - zB;
  // parapet on the road-facing edge
  S.box(side * (xNear + 0.1), y + 0.5, (zA + zB) / 2, 0.2, 0.8, len, shade(0xb9b4a8, rng.range(0.85, 1.05)));
  if (rng.chance(0.7)) {                      // water tank(s)
    const tz = zB + len * rng.range(0.25, 0.75);
    S.cylY(cx, y + 0.2, tz, 0.9, 1.6, 6, rng.pick([0x1f5fa8, 0x2c3e50, 0x34495e, 0xdadada]));
    S.box(cx, y + 0.4, tz, 1.6, 0.4, 1.6, 0x8a8a86);
  }
  if (rng.chance(0.45)) S.box(cx + side * 2, y + 1.3, zB + len * rng.range(0.2, 0.8), 2.6, 2.2, 2.4, shade(0xc9c2b6, 0.95));   // stair house
  if (rng.chance(0.3)) {                      // satellite dish
    const dz = zB + len * rng.range(0.2, 0.8);
    S.box(cx - side * 1.5, y + 0.9, dz, 0.08, 1.4, 0.08, 0x888888);
    S.blob(cx - side * 1.5, y + 1.7, dz, 0.55, 0.55, 0.18, 0xe9e9e9, 6, 3);
  }
  if (zone.f && zone.f.tinRoofs && rng.chance(0.6)) S.box(cx, y + 0.5, zB + len * 0.5, 4.5, 0.12, 4, rng.pick([0x8c6a4f, 0x6f8aa3, 0x9a9da0]), { rz: 0.08 });
  // clothes line / tangled antenna
  
}

function acUnits(L, rng, side, xNear, zA, zB, floors, n) {
  const S = L.solid;
  for (let i = 0; i < n; i++) {
    const f = rng.int(1, Math.max(1, floors - 1)), z = rng.range(zB + 1, zA - 1);
    S.box(side * (xNear - 0.28), f * 3.2 + 1.0, z, 0.6, 0.5, 0.78, rng.pick([0xe9e9e6, 0xd9d9d4, 0xf4f4f0]));
  }
}

function balconies(L, rng, side, xNear, zA, zB, floors, n) {
  const S = L.solid;
  for (let i = 0; i < n; i++) {
    const f = rng.int(1, Math.max(1, floors - 1)), z = zB + 1.5 + Math.floor(rng.range(0, (zA - zB - 3) / 3)) * 3 + 1.5;
    const x = side * (xNear - 0.5);
    S.box(x, f * 3.2 + 0.1, z, 1.0, 0.12, 2.4, 0x9c978c);
    S.box(side * (xNear - 0.98), f * 3.2 + 0.7, z, 0.06, 0.9, 2.4, 0x2a2d31);
    for (let k = -1; k <= 1; k++) S.box(x, f * 3.2 + 0.7, z + k * 1.2, 1.0, 0.9, 0.05, 0x2a2d31, { f: F.PX | F.NX });
  }
}

/** Row of shops (ground floor) with 2-6 upper floors. */
export function shopRow(L, rng, zone, side, zA, zB, o = {}) {
  const S = L.solid;
  const xNear = WALK_OUT + (o.setback || 0), depth = o.depth || rng.range(13, 18);
  const dir = -side;
  const floors = o.floors || Math.max(2, Math.round(rng.range(zone.frontHeight[0], zone.frontHeight[1]) / 3.2));
  const wall = rng.pick(zone.palette);
  // ground floor body
  S.box(side * (xNear + depth / 2), 1.6, (zA + zB) / 2, depth, 3.2, zA - zB, shade(wall, 0.92), { f: wallMask(side) });
  facadeBox(L, side, xNear, depth, zA, zB, 3.2, floors * 3.2, wall);
  roofSlab(L, side, xNear, depth, zA, zB, floors * 3.2, 0x8f8a80);
  rooftop(L, rng, side, xNear, depth, zA, zB, floors * 3.2 + 0.2, zone);
  acUnits(L, rng, side, xNear, zA, zB, floors, rng.int(1, 3));
  if (rng.chance(0.45 * getDetail())) balconies(L, rng, side, xNear, zA, zB, floors, rng.int(1, 2));
  // shop units
  const fx = side * (xNear - 0.03);
  let z = zA;
  const dense = zone.market || 0.4;
  while (z > zB + 1.5) {
    const uw = Math.min(z - zB, rng.range(3.4, 5.4));
    const z0 = z - uw, zc = z - uw / 2;
    const closed = rng.chance(0.18);
    sideQuad(S, fx, 0.0, 2.5, z0 + 0.2, z - 0.2, dir, 0x2a2018);
    sideQuad(S, fx + dir * 0.01, 0.0, 0.5, z0 + 0.2, z - 0.2, dir, 0x4a3a2c);
    if (closed) sideQuad(S, fx + dir * 0.02, 0.0, 2.5, z0 + 0.2, z - 0.2, dir, rng.pick(SHUTTER));
    else if (rng.chance(0.4)) sideQuad(S, fx + dir * 0.02, 1.7, 2.5, z0 + 0.2, z - 0.2, dir, rng.pick(SHUTTER));
    // goods / vendor crates spilling onto the sidewalk
    if (!closed && rng.chance((0.2 + dense * 0.4) * getDetail())) {
      const gx = side * (xNear - 0.6 - rng.range(0, 0.8));
      for (let i = 0; i < rng.int(1, 2); i++) S.box(gx, WALK_Y + 0.25 + (i % 2) * 0.4, zc + rng.range(-uw / 3, uw / 3), 0.55, 0.5, 0.6, rng.pick(CRATE));
    }
    // fascia sign (Bangla) and awning
    L.sign.signX(side * (xNear - 0.07), 2.93, zc, uw - 0.15, 0.72, rng.pick(zone.shops), dir);
    if (rng.chance(0.5)) S.box(side * (xNear - 0.7), 2.65, zc, 1.4, 0.06, uw - 0.3, rng.pick(AWNING), { rz: side * 0.22, f: F.PY | F.PX | F.NX | F.PZ | F.NZ });
    z -= uw;
  }
  if (zone.f && zone.f.tinRoofs && rng.chance(0.55)) tinCanopy(L, side, zA - 0.5, zB + 0.5, rng);
  // occasional second row behind
  if (rng.chance(0.55)) {
    const h2 = floors * 3.2 + Math.round(rng.range(2, 7)) * 3.2;
    const xn = xNear + depth + 1.5;
    facadeBox(L, side, xn, 12, zA - 3, zB + 3, 0, h2, rng.pick(zone.palette));
    roofSlab(L, side, xn, 12, zA - 3, zB + 3, h2, 0x8a857b);
  }
  return floors * 3.2;
}

/** Residential mid-rise with balconies; shops only on the ground floor. */
export function midrise(L, rng, zone, side, zA, zB, o = {}) {
  const floors = Math.max(4, Math.round(rng.range(zone.height[0], zone.height[1]) / 3.2));
  shopRow(L, rng, zone, side, zA, zB, { ...o, floors });
  balconies(L, rng, side, WALK_OUT + (o.setback || 0), zA, zB, floors, Math.round(rng.int(2, 4) * getDetail()));
  return floors * 3.2;
}

/** Glass-curtain tower on a podium. */
export function tower(L, rng, zone, side, zA, zB, o = {}) {
  const S = L.solid;
  const xNear = WALK_OUT + (o.setback || 1.5), depth = rng.range(14, 20);
  const total = Math.round(rng.range(zone.height[0] + 6, zone.height[1] + 18) / 3.2);
  const tint = rng.pick([0xffffff, 0xcfe9f2, 0xd6f0e0, 0xf3e6c8]);
  S.box(side * (xNear + depth / 2), 2.0, (zA + zB) / 2, depth, 4.0, zA - zB, 0x9aa0a4, { f: wallMask(side) });
  L.sign.signX(side * (xNear - 0.05), 3.6, (zA + zB) / 2, Math.min(zA - zB - 2, 9), 0.9, rng.pick(zone.shops), -side);
  facadeBox(L, side, xNear + 0.4, depth - 0.8, zA - 0.6, zB + 0.6, 4.0, total * 3.2, tint, true);
  roofSlab(L, side, xNear + 0.4, depth - 0.8, zA - 0.6, zB + 0.6, total * 3.2, 0x7d8386);
  S.box(side * (xNear + depth * 0.5), total * 3.2 + 2.2, (zA + zB) / 2, depth * 0.45, 3.6, (zA - zB) * 0.45, 0x8e9498);
  S.box(side * (xNear + depth * 0.5), total * 3.2 + 6.5, (zA + zB) / 2, 0.15, 6.0, 0.15, 0x666a6e);
  if (rng.chance(0.7)) billboard(L, side, side * (xNear + 2.5), total * 3.2 + 4.2, (zA + zB) / 2, Math.min(9, zA - zB - 2), 3.4, rng.pick(zone.ads), false);
  if (rng.chance(0.5)) facadeBox(L, side, xNear + depth + 2, 12, zA - 3, zB + 3, 0, (total + 4) * 3.2, tint, true);
  return total * 3.2;
}

/** Government complex: big set-back block, lawn, boundary wall + gate, flag, trees. */
export function institution(L, rng, zone, side, zA, zB) {
  const S = L.solid, zc = (zA + zB) / 2;
  const lawn = 0x6b8f4e;
  S.floor(Math.min(side * WALK_OUT, side * 40), Math.max(side * WALK_OUT, side * 40), zB, zA, 0.03, lawn);
  S.box(side * (WALK_OUT + 0.3), 0.9, zc, 0.5, 1.8, zA - zB, 0xc9c0ae, { f: F.ALL });          // boundary wall
  for (let z = zB + 3; z < zA - 1; z += 6) S.box(side * (WALK_OUT + 0.3), 1.95, z, 0.65, 0.3, 0.65, 0xb7ad99);
  // gate with Bangla name board
  S.box(side * (WALK_OUT + 0.3), 1.2, zc, 0.6, 2.4, 8, 0x222222, { f: F.SIDES });
  for (const dz of [-4.2, 4.2]) S.box(side * (WALK_OUT + 0.3), 2.0, zc + dz, 0.9, 4.0, 0.9, 0xb7ad99);
  S.box(side * (WALK_OUT + 0.3), 4.35, zc, 0.6, 1.3, 9.2, 0x2e5339);
  L.sign.signX(side * (WALK_OUT - 0.04), 4.35, zc, 8.6, 1.1, SIGN.GOVT, -side);
  // main block
  const xn = 34, floors = rng.int(3, 5), h = floors * 3.6;
  const wall = rng.pick(zone.palette);
  facadeBox(L, side, xn, 16, zA - 1, zB + 1, 0, h, wall);
  roofSlab(L, side, xn, 16, zA - 1, zB + 1, h, 0x8a857b);
  S.box(side * (xn - 1.0), 1.2, zc, 2.0, 2.4, 14, 0xd8d0bd);                                      // portico base
  for (let i = -2; i <= 2; i++) S.cylY(side * (xn - 1.8), WALK_Y, zc + i * 3, 0.35, 6.5, 8, 0xf1ece0);
  S.box(side * (xn - 1.8), 6.9, zc, 2.8, 0.7, 15, 0xe6dfcd);
  // flag
  const fz = zA - 6, fx = side * 23;
  S.cylY(fx, 0, fz, 0.07, 12, 6, 0xbfc3c7);
  S.box(fx, 11.0, fz - 0.9, 0.03, 1.2, 1.8, 0x0a6b3d);
  S.blob(fx - side * 0.03, 11.0, fz - 0.85, 0.02, 0.36, 0.36, 0xd62828, 6, 3);
  // trees in the lawn
  for (let i = 0; i < 4; i++) tree(L, side * rng.range(21, 30), rng.range(zB + 3, zA - 3), rng, 'tall', 0x3d7a3a);
}

/** Large stadium wall with floodlight masts (Mirpur). Occupies the whole segment. */
export function stadium(L, rng, side, zA, zB) {
  const S = L.solid, zc = (zA + zB) / 2, len = zA - zB;
  S.floor(Math.min(side * WALK_OUT, side * 36), Math.max(side * WALK_OUT, side * 36), zB, zA, 0.03, 0x7b8f5e);
  const xn = 36;
  const baseCol = 0xd9cfc2;
  S.box(side * (xn + 6), 7, zc, 12, 14, len - 4, baseCol, { f: faceMask(side) });
  for (let z = zB + 4; z < zA - 3; z += 3) {
    S.box(side * (xn - 0.12), 4.5, z, 0.3, 9, 1.2, (Math.round(z / 3) % 2) ? 0x8e1b1b : 0x2a4a7a);
  }
  S.box(side * (xn + 14), 12, zc, 16, 24, len - 10, 0xbdb4a6, { f: faceMask(side) });
  // ticket gate + name
  S.box(side * (WALK_OUT + 0.3), 1.2, zc, 0.6, 2.4, 10, 0x222222, { f: F.SIDES });
  for (const dz of [-5.5, 5.5]) S.box(side * (WALK_OUT + 0.3), 2.2, zc + dz, 1.0, 4.4, 1.0, 0xc9bfae);
  S.box(side * (WALK_OUT + 0.3), 4.9, zc, 0.8, 1.6, 12, 0x8e1b1b);
  L.sign.signX(side * (WALK_OUT - 0.1), 4.9, zc, 11.4, 1.4, SIGN.STADIUM, -side);
  S.box(side * (WALK_OUT + 0.3), 0.9, zc, 0.5, 1.8, len, 0xcfc6b6, { f: F.ALL });
  for (const dz of [-len * 0.35, len * 0.35]) {
    const mx = side * 30;
    S.box(mx, 14, zc + dz, 0.6, 28, 0.6, 0x7b7f84);
    S.box(mx - side * 0.5, 28.3, zc + dz, 0.5, 2.4, 4.4, 0x2d3034);
    L.glow.box(mx - side * 0.8, 28.3, zc + dz, 0.12, 2.0, 4.0, 0xfff7d6, { f: 63 });
  }
}

export function school(L, rng, zone, side, zA, zB) {
  const S = L.solid, zc = (zA + zB) / 2;
  S.box(side * (WALK_OUT + 0.3), 1.0, zc, 0.5, 2.0, zA - zB, 0xe2c14a, { f: F.ALL });
  S.box(side * (WALK_OUT + 0.3), 3.0, zc, 0.7, 2.6, 7, 0x1a4f8b, { f: F.ALL });
  L.sign.signX(side * (WALK_OUT - 0.06), 3.3, zc, 6.6, 0.9, SIGN.SCHOOL_GATE, -side);
  S.floor(Math.min(side * WALK_OUT, side * 30), Math.max(side * WALK_OUT, side * 30), zB, zA, 0.03, 0xb6a98a);
  const wall = 0xe9c46a;
  facadeBox(L, side, 30, 14, zA - 2, zB + 2, 0, 3 * 3.6, wall);
  roofSlab(L, side, 30, 14, zA - 2, zB + 2, 10.8, 0x8a857b);
  for (let i = 0; i < 6; i++) pedestrian(L, side * rng.range(21, 27), rng.range(zB + 3, zA - 3), rng, 0.03);
  tree(L, side * 21, zA - 4, rng, 'tall', 0x3d7a3a);
  tree(L, side * 22, zB + 4, rng, 'tall', 0x4a8a3c);
}

/** Gap between buildings with a side road running away from the main road. */
export function sideStreet(L, rng, zone, side, zA, zB) {
  const S = L.solid, zc = (zA + zB) / 2;
  const xa = side * WALK_OUT, xb = side * 66;
  S.floor(Math.min(xa, xb), Math.max(xa, xb), zB, zA, 0.012, shade(zone.road, 1.05));
  S.floor(Math.min(xa, xb), Math.max(xa, xb), zB + 0.9, zB + 1.0, 0.02, 0xcfc9b8);
  S.floor(Math.min(xa, xb), Math.max(xa, xb), zA - 1.0, zA - 0.9, 0.02, 0xcfc9b8);
  facadeBox(L, side, 66, 10, zA, zB, 0, rng.range(12, 24), rng.pick(zone.palette));
  // narrow-street life: rickshaw, vendors, hanging boards
  if (rng.chance(0.8)) parkedVehicle(L, 'rickshaw', rng.int(0, 5), side * rng.range(22, 40), zc + rng.range(-1.5, 1.5), side > 0 ? Math.PI / 2 : -Math.PI / 2);
  if (rng.chance(0.5)) parkedVehicle(L, 'cng', rng.int(0, 2), side * rng.range(30, 50), zc + rng.range(-1.5, 1.5), side > 0 ? Math.PI / 2 : -Math.PI / 2);
  for (let i = 0; i < rng.int(2, 5); i++) pedestrian(L, side * rng.range(20, 50), zc + rng.range(-3.5, 3.5), rng, 0.02);
  // projecting blade signs on the walls of the neighbouring buildings (readable from the main road)
  const half = (zA - zB) / 2 - 0.1;
  for (let i = 0; i < 2; i++) {
    const x = side * rng.range(24, 44), zz = zc + (i === 0 ? half : -half);
    signFace(L.sign, x, rng.range(3.0, 4.2), zz, 2.4, 0.7, -side, 0, rng.pick(zone.shops));
    L.solid.box(x, 3.7, zz, 0.08, 0.08, 0.08, 0x333333);
  }
}

/** Bamboo-scaffolded construction site behind a tin hoarding. */
export function construction(L, rng, zone, side, zA, zB) {
  const S = L.solid;
  const xn = WALK_OUT + 0.5, floors = rng.int(3, 7);
  S.box(side * (WALK_OUT + 0.15), 1.2, (zA + zB) / 2, 0.15, 2.4, zA - zB, rng.pick([0x2f6f9a, 0x3f8f5f, 0xb5543a]), { f: faceMask(side) & ~F.PY });
  facadeBox(L, side, xn + 3, 12, zA - 1, zB + 1, 0, floors * 3.2, 0xb5afa3);
  for (let f = 1; f <= floors; f++) S.box(side * (xn + 9), f * 3.2, (zA + zB) / 2, 12, 0.35, zA - zB - 2, 0x8d8a82);
  // bamboo scaffolding
  const bam = 0xb89b5e;
  for (let z = zB + 1.2; z < zA - 0.5; z += 1.5) S.box(side * (xn + 2.6), floors * 1.6 + 0.2, z, 0.09, floors * 3.2 + 1.2, 0.09, bam);
  for (let y = 1.6; y < floors * 3.2 + 1.5; y += 1.6) S.box(side * (xn + 2.6), y, (zA + zB) / 2, 0.09, 0.09, zA - zB - 1, bam);
  for (let y = 3.2; y < floors * 3.2 + 1.5; y += 3.2) S.box(side * (xn + 2.1), y, (zA + zB) / 2, 1.2, 0.05, zA - zB - 1, 0x8c7a4b);
  S.box(side * (xn + 9), floors * 3.2 + 2.2, (zA + zB) / 2, 0.4, 5, 0.4, 0xd9a33b);          // crane mast stub
}

/** Distant skyline silhouettes for depth. Muted towards the fog colour. */
export function backdrop(L, rng, zone, zA, zB) {
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const w = rng.pick([18, 24, 30]), z = rng.range(zB + w / 2, zA - w / 2);
      const x = rng.range(52, 120), h = rng.range(zone.height[0] + 8, zone.height[1] + 30);
      const col = mixHex(rng.pick(zone.palette), zone.fog, 0.45);
      facadeBox(L, side, x, 22, z + w / 2, z - w / 2, 0, h, col);
      L.solid.box(side * (x + 11), h + 0.1, z, 22, 0.2, w, 0x8b8880, { f: F.PY });
    }
  }
}
