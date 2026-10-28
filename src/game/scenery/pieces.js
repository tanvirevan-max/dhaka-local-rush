// Reusable road-side pieces. Every function writes into the chunk's GeoBuilder layers `L`:
//   L.solid (vertex colours)  L.facade / L.glass (tiled window textures)  L.sign (Bangla sign atlas)  L.glow (unlit)
// Conventions: side = -1 is the LEFT (player) side of the road (x < 0), +1 is the right side.
// Pieces that must be solid for vehicles report them via the `obstacles` array: { x, z, hw, hl }.
import { F, mixHex, resolveCell } from '../geo.js';
import { SKIN, SHIRT, LUNGI } from '../models/common.js';
import { getDetail } from './detail.js';
import { SIGN } from '../../config/signs.js';

export const ROAD = 14.4;          // asphalt half width
export const WALK_OUT = 18.0;      // sidewalk outer edge
export const WALK_Y = 0.18;
const POLE = 0x4c5056;

// ------------------------------------------------------------------------------------------------
// wires
function wireZ(S, x, y0, z0, y1, z1, sag, t = 0.04, hex = 0x1e2023) {
  const n = 2;
  let pz = z0, py = y0;
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const cz = z0 + (z1 - z0) * u, cy = y0 + (y1 - y0) * u - sag * 4 * u * (1 - u);
    const len = Math.hypot(cz - pz, cy - py);
    S.box(x, (py + cy) / 2, (pz + cz) / 2, t, t, len, hex, { rx: Math.atan2(-(cy - py), cz - pz), f: F.PX | F.NX | F.PY | F.NY });
    pz = cz; py = cy;
  }
}

function wireX(S, x0, y0, x1, y1, z, sag, t = 0.04, hex = 0x1e2023) {
  const n = 4;
  let px = x0, py = y0;
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const cx = x0 + (x1 - x0) * u, cy = y0 + (y1 - y0) * u - sag * 4 * u * (1 - u);
    const len = Math.hypot(cx - px, cy - py);
    S.box((px + cx) / 2, (py + cy) / 2, z, len, t, t, hex, { rz: Math.atan2(cy - py, cx - px), f: F.PY | F.NY | F.PZ | F.NZ });
    px = cx; py = cy;
  }
}

/** Overhead utility lines along one side + sagging cross-road lines at each pole. Poles every 24 m (global z grid). */
export function utilityLines(L, side, zA, zB, rng, density = 1) {
  const S = L.solid, SP = 24;
  const x = side * 15.9;
  for (let pz = Math.ceil(zB / SP) * SP; pz - SP < zA; pz += SP) {
    const pzn = pz - SP;                               // next pole further along the road (lower z)
    if (pz <= zA) {
      S.box(x, 4.75, pz, 0.3, 9.5, 0.3, 0x9b9a94, { g0: 0.8, g1: 1 });
      S.box(x - side * 0.5, 8.9, pz, 1.9, 0.12, 0.14, 0x56524c);
      S.box(x, 9.55, pz, 0.12, 0.1, 0.12, 0x56524c);
      if (rng.chance(0.4)) S.cylY(x - side * 0.5, 7.0, pz, 0.26, 0.8, 7, 0x6c7076);       // transformer
      if (rng.chance(0.5 * density)) wireX(S, x, 8.7, -x, 8.3 + rng.range(0, 0.4), pz, 0.7 + rng.range(0, 0.5));
      if (rng.chance(0.35 * density)) wireX(S, x, 8.4, -x, 8.0 + rng.range(0, 0.5), pz + 0.4, 0.9 + rng.range(0, 0.5), 0.05);
    }
    // the part of the span between this pole and the next that lies inside the chunk
    const a = Math.max(pzn, zB), b = Math.min(pz, zA);
    if (b - a < 0.2) continue;
    const nWires = getDetail() < 0.8 ? 2 : 3;
    for (let w = 0; w < nWires; w++) {
      const wx = x + side * 0.35 - side * w * 0.34;
      const y = 8.82 + (w % 2) * 0.05, sag = 0.35 + w * 0.08;
      const yAt = (zz) => { const u = (pz - zz) / SP; return y - sag * 4 * u * (1 - u); };
      wireZ(S, wx, yAt(a), a, yAt(b), b, 0.02, 0.05);
    }
  }
}

// ------------------------------------------------------------------------------------------------
// lights, signals, signs
export function streetLight(L, side, z) {
  const S = L.solid, x = side * 15.7;
  S.box(x, 0.35, z, 0.5, 0.7, 0.5, 0x6b6e72);
  S.box(x, 4.2, z, 0.17, 8.2, 0.17, POLE, { g0: 0.8, g1: 1 });
  S.box(x - side * 1.4, 8.2, z, 2.9, 0.1, 0.1, POLE);
  S.box(x - side * 2.85, 8.12, z, 1.1, 0.14, 0.4, 0xdddddd);
  L.glow.box(x - side * 2.85, 8.04, z, 1.0, 0.05, 0.34, 0xfff1c4, { f: 63 });
}

export function medianLamp(L, z, obstacles) {
  const S = L.solid;
  S.box(0, 0.25, z, 0.5, 0.5, 0.5, 0x777a7e);
  S.box(0, 3.7, z, 0.2, 7.4, 0.2, POLE, { g0: 0.8, g1: 1 });
  for (const s of [-1, 1]) {
    S.box(s * 1.35, 7.35, z, 2.7, 0.09, 0.09, POLE);
    S.box(s * 2.7, 7.3, z, 1.0, 0.13, 0.38, 0xdddddd);
    L.glow.box(s * 2.7, 7.23, z, 0.9, 0.05, 0.32, 0xfff1c4, { f: 63 });
  }
  obstacles.push({ x: 0, z, hw: 0.28, hl: 0.28 });
}

export function trafficSignal(L, side, z, rng) {
  const S = L.solid, x = side * 15.0;
  S.box(x, 3.0, z, 0.18, 6.0, 0.18, 0x3a3d42);
  S.box(x - side * 2.6, 5.9, z, 5.2, 0.14, 0.14, 0x3a3d42);
  for (const dx of [2.6, 5.0]) {
    const bx = x - side * dx;
    S.box(bx, 5.35, z, 0.42, 1.15, 0.34, 0x1f2124);
    const lit = rng.int(0, 2);
    const cols = [[0xff3b30, 0x4a1411], [0xffc400, 0x4a3a00], [0x2ecc71, 0x103a22]];
    for (let i = 0; i < 3; i++) (lit === i ? L.glow : S).box(bx, 5.72 - i * 0.36, z + 0.18, 0.26, 0.26, 0.04, lit === i ? cols[i][0] : cols[i][1], { f: 63 });
  }
}

export function roadSign(L, side, z, cell, w = 1.7, h = 0.56) {
  const S = L.solid, x = side * 14.95;
  S.box(x, 1.5, z, 0.1, 3.0, 0.1, 0x8a8d90);
  L.sign.signZ(x, 3.2, z + 0.07, w, h, cell);
  S.box(x, 3.2, z + 0.04, w + 0.08, h + 0.08, 0.04, 0x30343a);
}

/** Sign quad with an arbitrary horizontal facing direction (nx,nz). */
export function signFace(builder, cx, cy, cz, w, h, nx, nz, cell, tint = 0xffffff) {
  const [u0, v0, u1, v1] = resolveCell(cell);
  const rx = nz, rz = -nx; // right-hand tangent seen from the front
  const hx = rx * w / 2, hz = rz * w / 2, hy = h / 2;
  builder.q(cx - hx, cy - hy, cz - hz, cx + hx, cy - hy, cz + hz, cx + hx, cy + hy, cz + hz, cx - hx, cy + hy, cz - hz, tint, u0, v0, u1, v1);
}

/** Roof / ground billboard angled towards approaching traffic. cells = atlas cell array. */
export function billboard(L, side, x, y, z, w, h, cell, legs = true) {
  const S = L.solid;
  const nx = -side * 0.55, nz = 0.835;
  const len = Math.hypot(nx, nz);
  signFace(L.sign, x, y, z, w, h, nx / len, nz / len, cell);
  // frame + back + legs
  const yaw = Math.atan2(nx, nz);
  S.box(x - nx * 0.12, y, z - nz * 0.12, w + 0.3, h + 0.3, 0.14, 0x2a2d31, { ry: yaw, f: F.ALL });
  if (legs && y - h / 2 > 0.6) {
    const tx = nz / len, tz = -nx / len;
    for (const dx of [-0.34, 0.34]) S.box(x + tx * dx * w, (y - h / 2) / 2, z + tz * dx * w, 0.22, y - h / 2, 0.22, 0x3a3d42);
  }
}

export function gantry(L, z, gateCell, dirCells = []) {
  const S = L.solid;
  for (const s of [-1, 1]) S.box(s * 16.6, 3.4, z, 0.6, 6.8, 0.6, 0x3d4147, { g0: 0.8, g1: 1 });
  S.box(0, 6.05, z, 34, 0.5, 0.6, 0x3d4147, { f: F.ALL });
  S.box(0, 7.25, z, 21.6, 2.1, 0.3, 0x15171a);
  L.sign.signZ(0, 7.25, z + 0.17, 21, 1.8, gateCell);
  for (const s of [-1, 1]) for (const dx of [-0.35, 0.35]) S.box(s * 10.0 + dx * 20, 6.3, z, 0.12, 0.7, 0.12, 0x3d4147);
  dirCells.forEach((c, i) => {
    const x = -8.5 + i * 8.5;
    L.sign.signZ(x, 5.1, z + 0.35, 5.2, 1.3, c);
    S.box(x, 5.1, z + 0.31, 5.3, 1.4, 0.06, 0x20262b);
    S.box(x, 5.8, z + 0.15, 0.1, 0.5, 0.1, 0x3d4147);
  });
}

// ------------------------------------------------------------------------------------------------
// organic stuff
export function tree(L, x, z, rng, kind = 'round', crown = 0x3d7a3a) {
  const S = L.solid;
  if (kind === 'shrub') {
    S.blob(x, 0.32, z, 0.7, 0.42, 0.7, mixHex(crown, 0x2b5a2a, rng.f()), 5, 2);
    return;
  }
  const big = kind === 'tall';
  const h = big ? rng.range(4.5, 6.2) : rng.range(2.6, 3.6);
  const r = big ? rng.range(2.2, 2.9) : rng.range(1.5, 2.1);
  S.cylY(x, WALK_Y, z, big ? 0.3 : 0.2, h, 5, 0x5a4331, big ? 0.2 : 0.14);
  const n = big ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, 6.28), d = rng.range(0, r * 0.4);
    S.blob(x + Math.cos(a) * d, WALK_Y + h + rng.range(-0.2, r * 0.45), z + Math.sin(a) * d, r * rng.range(0.8, 1.05), r * rng.range(0.6, 0.85), r * rng.range(0.8, 1.05),
      mixHex(crown, 0x1f4a22, rng.f() * 0.5), 6, 3);
  }
}

/** Very cheap standing person for scenery (~70 vertices instead of ~270). */
export function litePerson(b, x, y, z, shirt, skin, legs, h = 1) {
  b.box(x, y + 0.42 * h, z, 0.3, 0.84 * h, 0.2, legs, { f: F.SIDES });
  b.box(x, y + 1.14 * h, z, 0.44, 0.62 * h, 0.26, shirt);
  b.box(x, y + 1.62 * h, z, 0.22, 0.24 * h, 0.22, skin);
  b.box(x, y + 1.76 * h, z, 0.235, 0.07 * h, 0.235, 0x16120f, { f: F.PY | F.SIDES });
}

export function pedestrian(L, x, z, rng, y = WALK_Y) {
  const lungi = rng.chance(0.3);
  litePerson(L.solid, x, y, z, rng.pick(SHIRT), rng.pick(SKIN), lungi ? rng.pick(LUNGI) : rng.pick([0x2b3140, 0x3d3a36, 0x1f2a44]), rng.range(0.92, 1.03));
}

export function crowd(L, side, zA, zB, rng, n, xMin = 15.0, xMax = 17.6) {
  for (let i = 0; i < n; i++) pedestrian(L, side * rng.range(xMin, xMax), rng.range(zB + 0.6, zA - 0.6), rng);
}

export function stall(L, side, x, z, rng) {
  const S = L.solid, X = side * x;
  const kind = rng.int(0, 3);
  const cols = [0xe63946, 0xf4a261, 0x2a9d8f, 0xffb703, 0x4361ee, 0x7b2cbf];
  const c1 = rng.pick(cols), c2 = rng.pick([0xffffff, 0xfff1a8, 0x222222]);
  if (kind === 0) {              // umbrella fruit stall
    S.box(X, 0.62, z, 1.7, 0.1, 0.9, 0x7a5a3a); S.box(X, 0.32, z, 1.5, 0.64, 0.7, 0x5a4331);
    S.cylY(X, WALK_Y, z, 0.04, 2.4, 5, 0x888888);
    for (let i = 0; i < 8; i++) S.tri(X, WALK_Y + 2.75, z, X + Math.cos((i + 1) * 0.785) * 1.55, WALK_Y + 2.15, z + Math.sin((i + 1) * 0.785) * 1.55, X + Math.cos(i * 0.785) * 1.55, WALK_Y + 2.15, z + Math.sin(i * 0.785) * 1.55, i % 2 ? c1 : c2);
    for (let i = 0; i < 4; i++) S.blob(X - 0.6 + i * 0.4, 0.86, z, 0.17, 0.12, 0.17, rng.pick([0xe63946, 0xf9c74f, 0x90be6d, 0xf8961e]), 5, 3);
  } else if (kind === 1) {       // tea stall with tin roof
    S.box(X, 1.1, z, 2.0, 2.0, 1.8, 0x7a5a3a, { f: F.SIDES });
    S.box(X - side * 0.2, 2.3, z, 2.6, 0.12, 2.3, 0x8a8f94, { rx: 0.0, rz: side * 0.12 });
    S.box(X + side * 0.7, 1.0, z, 0.9, 0.5, 1.6, 0x2a2a2a);
    L.glow.box(X - side * 0.2, 1.2, z + 0.6, 0.3, 0.3, 0.05, 0xffd54f);
  } else if (kind === 2) {       // cart (puffed rice / ice-cream)
    S.box(X, 0.75, z, 1.1, 0.7, 0.8, c1);
    S.box(X, 1.4, z, 1.2, 0.08, 0.9, c2);
    S.cylY(X + 0.5, WALK_Y, z, 0.03, 1.4, 5, 0x555555);
    S.cylX(X, 0.34, z + 0.5, 0.3, 0.06, 8, 0x222222);
    S.cylX(X, 0.34, z - 0.5, 0.3, 0.06, 8, 0x222222);
  } else {                       // mat with shoes / clothes
    S.box(X, 0.22, z, 2.0, 0.04, 1.4, rng.pick(cols));
    for (let i = 0; i < 6; i++) S.box(X - 0.8 + i * 0.32, 0.3, z + rng.range(-0.4, 0.4), 0.22, 0.12, 0.3, rng.pick(cols));
  }
  pedestrian(L, X + side * 1.1, z + rng.range(-0.4, 0.4), rng);
}

/** Parked rickshaw / CNG built from a few boxes (the full vehicle models are too heavy for scenery). */
export function parkedVehicle(L, type, variant, x, z, yaw) {
  const S = L.solid, s = Math.sin(yaw), c = Math.cos(yaw);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const bx = (lx, ly, lz, sx, sy, sz, hex) => { const [px, pz] = at(lx, lz); S.box(px, WALK_Y + ly, pz, sx, sy, sz, hex, { ry: yaw }); };
  const art = [0xe63946, 0xffb703, 0x2a9d8f, 0x4361ee, 0xf72585, 0xff6d00][variant % 6];
  if (type === 'cng') {
    const body = [0x2f9e44, 0x2b8a3e, 0x1f7a8c][variant % 3];
    bx(0, 0.75, 0.1, 1.4, 0.7, 2.0, body); bx(0, 1.65, 0.2, 1.4, 0.08, 1.8, 0x1b2a1f);
    for (const sx of [-1, 1]) for (const lz of [-0.6, 0.9]) bx(sx * 0.68, 1.2, lz, 0.06, 0.9, 0.06, 0x181818);
    bx(0, 0.3, 0.9, 1.4, 0.5, 0.5, 0x1b1b1b);
  } else {
    bx(0, 0.7, 0.45, 0.9, 0.35, 1.3, art); bx(0, 1.35, 0.7, 0.95, 0.1, 0.9, art);
    bx(0, 0.35, -0.9, 0.08, 0.7, 0.8, 0x222222); bx(0, 1.0, -0.9, 0.6, 0.04, 0.04, 0x222222);
    bx(0, 0.4, 0.4, 1.1, 0.7, 0.12, 0x222222);
  }
}

// ------------------------------------------------------------------------------------------------
// bus stop (left side registers a pickup stop; right side is scenery only)
export function busStop(L, side, z, rng, zone) {
  const S = L.solid, x = side * 16.8;
  // shelter: tin roof on 4 poles, bench, ad panel
  S.box(x, 2.75, z, 2.0, 0.12, 4.4, rng.pick([0x5c7a99, 0x8a8f94, 0xb05a3a]), { rz: side * 0.05 });
  for (const dz of [-2, 2]) for (const dx of [-0.9, 0.9]) S.box(x + dx, 1.5, z + dz, 0.09, 2.7, 0.09, 0x3d4147);
  S.box(x + side * 0.85, 1.05, z, 0.1, 1.6, 4.2, 0x2f3338);
  S.box(x - side * 0.2, 0.55, z, 0.5, 0.08, 3.6, 0x8d6e4f);
  L.sign.signX(x + side * 0.92, 1.4, z, 3.4, 0.85, rng.pick(zone.ads), -side);
  // sign pole + BUS STOP board
  S.box(side * 14.95, 1.7, z + 3.6, 0.1, 3.4, 0.1, 0x8a8d90);
  L.sign.signZ(side * 14.95, 3.45, z + 3.67, 1.7, 0.56, SIGN.BUS_STOP);
  if (side > 0) { crowd(L, side, z + 2, z - 2, rng, 3, 15.4, 16.4); return null; }
  // painted bay on the kerb lane
  S.floor(-14.38, -11.1, z - 6.5, z + 6.5, 0.016, 0xe9c63b);
  S.floor(-14.2, -11.3, z - 6.2, z + 6.2, 0.018, zone.road);
  for (let i = -2; i <= 2; i++) S.floor(-14.0, -11.5, z + i * 2.4 - 0.12, z + i * 2.4 + 0.12, 0.02, 0xf2f2f2);
  const pax = [];
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) pax.push({ x: -rng.range(15.3, 16.2), z: z + rng.range(-2.2, 2.2), seed: rng.int(0, 99) });
  return { z, x: -12.7, side: -1, served: false, pax };
}

// ------------------------------------------------------------------------------------------------
// overhead structures
export function zebra(L, z, zone) {
  const S = L.solid;
  for (let x = -ROAD + 0.4; x < ROAD - 0.3; x += 1.15) {
    if (Math.abs(x) < 1.0) continue;
    S.floor(x - 0.28, x + 0.28, z - 1.8, z + 1.8, 0.022, 0xf0f0ec);
  }
  S.floor(-ROAD, -0.9, z + 2.6, z + 2.9, 0.022, 0xf0f0ec);
  S.floor(0.9, ROAD, z - 2.9, z - 2.6, 0.022, 0xf0f0ec);
}

/** Covered pedestrian footbridge over the whole road with ad boards. */
export function footbridge(L, z, rng, zone, obstacles) {
  const S = L.solid, Y = 5.85;
  S.box(0, Y + 0.25, z, 35, 0.5, 3.0, 0x8e8a82, { f: F.ALL });
  S.box(0, Y + 1.0, z, 35, 0.12, 3.4, 0x6b7f94);                                  // roof
  for (let x = -16; x <= 16; x += 4) S.box(x, Y + 0.95, z - 1.5, 0.1, 1.5, 0.1, 0x3d4147);
  for (let x = -16; x <= 16; x += 4) S.box(x, Y + 0.95, z + 1.5, 0.1, 1.5, 0.1, 0x3d4147);
  S.box(0, Y + 0.85, z + 1.55, 35, 0.9, 0.08, 0x9a9890);                           // railing wall
  const cells = zone.ads;
  for (let i = 0; i < 4; i++) {
    const x = -13 + i * 8.7;
    L.sign.signZ(x, Y + 0.85, z + 1.62, 6.8, 0.85, cells[(i + rng.int(0, 3)) % cells.length]);
  }
  for (const s of [-1, 1]) {
    S.box(s * 16.2, Y / 2, z, 0.8, Y, 1.2, 0x8e8a82);
    // stairs along the sidewalk
    const dir = rng.chance(0.5) ? 1 : -1, run = 12;
    const ang = Math.atan2(Y, run);
    S.box(s * 16.8, Y / 2, z + dir * (run / 2 + 0.6), 1.8, 0.35, Math.hypot(Y, run), 0x8e8a82, { rx: dir > 0 ? -ang : ang, f: F.ALL });
    S.box(s * 17.85, Y / 2 + 0.6, z + dir * (run / 2 + 0.6), 0.1, 1.0, Math.hypot(Y, run), 0x3d4147, { rx: dir > 0 ? -ang : ang });
  }
  S.box(0, Y / 2, z, 1.3, Y, 1.3, 0x8e8a82);
  obstacles.push({ x: 0, z, hw: 0.7, hl: 0.7 });
}

/** Continuous flyover deck above the median, with piers every 24 m (global grid). */
export function flyoverSpan(L, zA, zB, obstacles) {
  const S = L.solid, len = zA - zB, zc = (zA + zB) / 2;
  S.box(0, 8.2, zc, 12.4, 1.3, len, 0x8f8d86, { f: F.ALL, g0: 0.75, g1: 1 });
  for (const s of [-1, 1]) {
    S.box(s * 6.0, 9.3, zc, 0.5, 0.9, len, 0xb4b1a8);
    for (let z = Math.floor(zA / 4) * 4; z > zB; z -= 4) if (z <= zA) S.box(s * 6.0, 9.3, z, 0.55, 0.95, 0.12, 0x9a978e);
  }
  const SP = 24;
  for (let pz = Math.floor(zA / SP) * SP; pz > zB - 0.01; pz -= SP) {
    if (pz > zA) continue;
    S.box(0, 3.5, pz, 1.5, 7.0, 1.5, 0x9a978e, { g0: 0.7, g1: 1 });
    S.box(0, 7.3, pz, 5.2, 0.8, 2.0, 0x8c8a82);
    obstacles.push({ x: 0, z: pz, hw: 0.78, hl: 0.78 });
  }
}

/** Elevated metro viaduct above the median (+ optional station). */
export function metroSpan(L, zA, zB, obstacles, station = false) {
  const S = L.solid, len = zA - zB, zc = (zA + zB) / 2;
  S.box(0, 10.4, zc, 8.6, 1.5, len, 0xb7b6b0, { f: F.ALL, g0: 0.8, g1: 1 });
  S.box(0, 11.3, zc, 8.8, 0.3, len, 0x7a8791, { f: F.ALL });
  for (const s of [-1, 1]) {
    S.box(s * 4.2, 11.8, zc, 0.2, 0.8, len, 0xc9ccd0);
    S.box(s * 4.32, 10.9, zc, 0.06, 0.28, len, 0x2a8c82, { f: F.ALL });
  }
  const SP = 30;
  for (let pz = Math.floor(zA / SP) * SP; pz > zB - 0.01; pz -= SP) {
    if (pz > zA) continue;
    S.box(0, 4.6, pz, 1.7, 9.2, 1.7, 0xaeada7, { g0: 0.7, g1: 1 });
    S.box(0, 9.3, pz, 7.4, 0.9, 2.2, 0xa5a49e);
    obstacles.push({ x: 0, z: pz, hw: 0.88, hl: 0.88 });
  }
  if (station) {
    const sz = zc;
    S.box(0, 12.4, sz, 13, 0.35, 40, 0x9fb7c8, { f: F.ALL });                          // canopy roof
    for (const s of [-1, 1]) S.box(s * 6.4, 11.8, sz, 0.35, 1.2, 40, 0x6f8fa6);
    S.box(0, 9.9, sz, 11, 0.4, 36, 0x8e9aa3, { f: F.ALL });                            // platform slab
    for (let dz = -16; dz <= 16; dz += 8) S.box(-5.2, 11.2, sz + dz, 0.2, 2.2, 0.2, 0x5a6168), S.box(5.2, 11.2, sz + dz, 0.2, 2.2, 0.2, 0x5a6168);
  }
}

/** Corrugated tin canopy over the sidewalk in front of a shop row. */
export function tinCanopy(L, side, zA, zB, rng, y = 3.55) {
  const S = L.solid, w = zA - zB;
  S.box(side * 16.2, y, (zA + zB) / 2, 3.2, 0.1, w, rng.pick([0x8c6a4f, 0x6f8aa3, 0x9a9da0, 0x7a4b3a]), { rz: side * 0.17, f: F.ALL });
  for (let z = zB + 1; z < zA - 0.5; z += 3.5) S.box(side * 14.7, y / 2 - 0.1, z, 0.08, y - 0.2, 0.08, 0x3d4147);
}
