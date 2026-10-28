// Builds one 84 m road chunk (both carriageways, median, sidewalks, frontage, furniture, overhead structures)
// into the chunk's GeoBuilder layers. Deterministic per chunk index, so a chunk always looks the same.
import { F, shade, mixHex } from '../geo.js';
import { sideQuad } from '../models/common.js';
import { Rng } from '../utils.js';
import { WORLD } from '../../config/gameConfig.js';
import { ZONES } from '../../config/zones.js';
import { SIGN } from '../../config/signs.js';
import * as P from './pieces.js';
import * as B from './buildings.js';
import { getDetail } from './detail.js';

const { laneWidth: LW, medianHalf: MH } = WORLD;
const ROAD = P.ROAD, WALK_OUT = P.WALK_OUT, WALK_Y = P.WALK_Y;
const WHITE = 0xefefe8, YELLOW = 0xe9c63b;

// building mix per area: relative weights of segment types
const MIX = {
  badda:    { shop: 3,   mid: 3,   tower: 3.5, construct: 0.7, side: 0.9 },
  rampura:  { shop: 6,   mid: 2,   tower: 0.2, construct: 0.8, side: 1.4 },
  mirpur:   { shop: 2.5, mid: 4,   tower: 0.4, construct: 0.4, side: 1.0 },
  mirpur10: { shop: 3,   mid: 3,   tower: 2.0, construct: 0.5, side: 0.9 },
  agargaon: { shop: 1.5, mid: 1.5, tower: 0.7, construct: 0.2, side: 0.5 },
};

/** Which area / position a chunk index belongs to. Negative indices use the first area. */
export function zoneInfo(k) {
  const kk = Math.max(0, k);
  const zoneSeq = Math.floor(kk / WORLD.zoneChunks);
  const zi = zoneSeq % ZONES.length;
  return { zone: ZONES[zi], zi, loop: Math.floor(zoneSeq / ZONES.length), zoneChunk: kk % WORLD.zoneChunks, k };
}

const snap3 = (v) => Math.max(6, Math.round(v / 3) * 3);

// Dev-only vertex profiling: set globalThis.__PROF = {} to collect per-section solid-layer vertex counts.
let _last = 0;
function mark(L, name) {
  const P = globalThis.__PROF;
  if (!P) return;
  const v = L.solid.v;
  P[name] = (P[name] || 0) + (v - _last);
  _last = v;
}

export function buildChunk(chunk, k) {
  const L = chunk.layers;
  for (const key in L) L[key].reset();
  chunk.obstacles.length = 0;
  chunk.stops.length = 0;

  const info = zoneInfo(k);
  const { zone, zoneChunk } = info;
  const f = zone.f;
  const len = WORLD.chunkLength;
  const zA = -k * len, zB = zA - len;
  const rng = new Rng((Math.imul(k + 1000, 2654435761) ^ 0x9e3779b9) >>> 0);
  const obstacles = chunk.obstacles;
  chunk.info = info;

  const hasFlyover = !!f.flyover && zoneChunk >= 1 && zoneChunk <= 7;
  const hasMetro = !!f.metro;
  const station = hasMetro && zoneChunk === 4;
  const overhead = hasFlyover || hasMetro;

  _last = 0;
  roadBase(L, zone, zA, zB, rng, info);
  mark(L, 'road');

  // ---- overhead structures
  if (zoneChunk === 0) P.gantry(L, zA - 8, SIGN.GATES[info.zi]);
  if (zoneChunk === 5) P.gantry(L, zA - 14, SIGN.TO_MIRPUR === zone.dirSigns[0] ? SIGN.METRO : zone.dirSigns[0], zone.dirSigns);
  if (hasFlyover) P.flyoverSpan(L, zA, zB, obstacles);
  if (hasMetro) P.metroSpan(L, zA, zB, obstacles, station);
  let bridgeZ = null;
  if (!station && rng.chance(f.footbridge || 0)) { bridgeZ = zA - rng.range(24, 60); P.footbridge(L, bridgeZ, rng, zone, obstacles); }
  if (zone.id === 'mirpur10' && zoneChunk === 3) roundaboutRing(L, zA - 42, obstacles);

  mark(L, 'overhead');
  // ---- median
  medianDressing(L, zone, zA, zB, rng, overhead, obstacles);
  mark(L, 'median');

  // ---- street furniture
  for (const side of [-1, 1]) {
    for (let z = Math.ceil(zB / 28) * 28; z <= zA; z += 28) if (((z / 28) & 1) === (side < 0 ? 0 : 1) || zone.id === 'badda') P.streetLight(L, side, z);
    P.utilityLines(L, side, zA, zB, rng, zone.id === 'rampura' ? 1.2 : 0.8);
  }
  const crossings = [];
  if (rng.chance(f.zebra || 0.3) && !station) {
    const z = zA - rng.range(14, 70);
    if (!bridgeZ || Math.abs(z - bridgeZ) > 18) { crossings.push(z); P.zebra(L, z, zone); }
  }
  if (rng.chance(f.sideRoad * 0.7)) {
    const z = zA - rng.range(10, 74);
    if (!crossings.length || Math.abs(z - crossings[0]) > 12) { P.trafficSignal(L, -1, z + 3, rng); P.trafficSignal(L, 1, z - 3, rng); }
  }
  if (rng.chance(0.5)) P.roadSign(L, -1, zA - rng.range(5, 75), rng.pick([SIGN.SPEED, SIGN.FOOTBRIDGE, zone.dirSigns[0]]));
  if (rng.chance(0.4)) P.roadSign(L, 1, zA - rng.range(5, 75), rng.pick([SIGN.SPEED, zone.dirSigns[1], SIGN.METRO]));
  if (f.school && zoneChunk >= 1 && zoneChunk <= 3) P.roadSign(L, -1, zA - 20, SIGN.SCHOOL);

  mark(L, 'furniture');
  // ---- frontage (buildings) per side
  for (const side of [-1, 1]) frontage(L, rng, zone, info, side, zA, zB);
  mark(L, 'frontage');

  // ---- sidewalk life: trees, stalls, pedestrians, bus stops
  for (const side of [-1, 1]) {
    sidewalkLife(L, rng, zone, side, zA, zB);
    if (f.busStops && rng.chance(side < 0 ? 0.62 : 0.4) && !station) {
      const sz = zA - rng.range(14, 70);
      if (!bridgeZ || Math.abs(sz - bridgeZ) > 14) {
        const stop = P.busStop(L, side, sz, rng, zone);
        if (stop) chunk.stops.push(stop);
      }
    }
  }

  mark(L, 'life');
  // rare banner across the road
  if (rng.chance(0.12)) {
    const z = zA - rng.range(20, 64);
    L.sign.signZ(0, 6.7, z, 24, 1.0, rng.pick([SIGN.SAFE_ROAD, SIGN.EID, SIGN.ADS[2]]));
    L.solid.box(0, 6.7, z - 0.04, 24.2, 1.1, 0.04, 0x15171a);
    for (const s of [-1, 1]) L.solid.box(s * 13.5, 3.35, z - 0.05, 0.1, 6.7, 0.1, 0x6f7276);
  }

  B.backdrop(L, rng, zone, zA, zB);

  // report overflow once while developing
  for (const key in L) if (L[key].overflowed && !chunk.warned) { chunk.warned = true; console.warn(`[chunk ${k}] layer "${key}" overflowed - raise its capacity`); }
}

// ------------------------------------------------------------------------------------------------
function roadBase(L, zone, zA, zB, rng, info) {
  const S = L.solid;
  const ground = mixHex(zone.fog, 0x8a7f68, 0.55);
  const walk = mixHex(0xa29d90, zone.fog, 0.15);
  // ground + asphalt
  S.floor(-140, 140, zB, zA, -0.04, ground);
  S.floor(-ROAD, -MH, zB, zA, 0, zone.road);
  S.floor(MH, ROAD, zB, zA, 0, shade(zone.road, 0.96));
  // worn wheel tracks and patches
  for (const sgn of [-1, 1]) for (let i = 0; i < 4; i++) {
    const cx = sgn * (MH + LW * (i + 0.5));
    for (const o of [-0.95, 0.95]) S.floor(cx + o - 0.35, cx + o + 0.35, zB, zA, 0.004, shade(zone.road, 0.9));
  }
  for (let i = 0; i < 10; i++) {
    const x = rng.range(-13, 13), z = rng.range(zB + 2, zA - 3), w = rng.range(0.8, 3), l = rng.range(1, 4);
    S.floor(x - w / 2, x + w / 2, z - l / 2, z + l / 2, 0.007, shade(zone.road, rng.range(0.82, 1.14)));
  }
  // lane markings (dashes on a global 9 m grid so chunks join seamlessly)
  for (const sgn of [-1, 1]) {
    for (let i = 1; i <= 3; i++) {
      const x = sgn * (MH + LW * i);
      for (let z = Math.ceil(zB / 9) * 9; z < zA; z += 9) S.floor(x - 0.07, x + 0.07, z, Math.min(z + 3.2, zA), 0.02, WHITE);
    }
    S.floor(sgn * (ROAD - 0.35) - 0.07, sgn * (ROAD - 0.35) + 0.07, zB, zA, 0.02, WHITE);
    S.floor(sgn * (MH + 0.22) - 0.06, sgn * (MH + 0.22) + 0.06, zB, zA, 0.02, YELLOW);
  }
  // median kerb (visible sides striped yellow/black, top concrete)
  S.box(0, 0.1, (zA + zB) / 2, 2 * MH, 0.2, zA - zB, 0xb5b0a5, { f: F.PY });
  for (let z = zB; z < zA - 0.1; z += 2) {
    const c = (Math.round(z / 2) & 1) ? 0xe0b020 : 0x25272a;
    sideQuad(S, -MH - 0.004, 0, 0.2, z, z + 2, -1, c);
    sideQuad(S, MH + 0.004, 0, 0.2, z, z + 2, 1, c);
  }
  // sidewalks: kerb face + paving tiles
  for (const side of [-1, 1]) {
    const x0 = side * ROAD, x1 = side * WALK_OUT;
    S.box((x0 + x1) / 2, WALK_Y / 2, (zA + zB) / 2, Math.abs(x1 - x0), WALK_Y, zA - zB, shade(walk, 0.95), { f: F.PZ | F.NZ | (side < 0 ? F.PX : F.NX), g0: 0.75, g1: 1 });
    for (let z = zB; z < zA - 0.1; z += 3) S.floor(Math.min(x0, x1), Math.max(x0, x1), z, z + 3, WALK_Y, shade(walk, 0.9 + ((Math.round(z / 3) * 7) % 5) * 0.03));
    // kerb edge paint
    S.floor(Math.min(x0, x0 + side * 0.18), Math.max(x0, x0 + side * 0.18), zB, zA, WALK_Y + 0.002, 0xcfc9b8);
  }
}

function medianDressing(L, zone, zA, zB, rng, overhead, obstacles) {
  for (let z = zB + 2; z < zA - 1; z += rng.range(4.5, 8) / Math.max(0.5, getDetail())) {
    if (zone.id === 'mirpur' && rng.chance(0.5)) P.tree(L, 0, z, rng, 'round', 0x3f8a3c);
    else P.tree(L, 0, z, rng, 'shrub', rng.pick([0x3d7a3a, 0x4f8f3f, 0x6a9a3a]));
  }
  if (!overhead) for (let z = Math.ceil(zB / 28) * 28; z <= zA; z += 28) P.medianLamp(L, z, obstacles);
}

function roundaboutRing(L, z, obstacles) {
  // painted "golchattar" ring (dashed yellow circle) + a monument on the median
  const S = L.solid, R = 12.5, n = 36;
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    S.q(c0 * (R - 0.15), 0.022, z + s0 * (R - 0.15), c1 * (R - 0.15), 0.022, z + s1 * (R - 0.15),
      c1 * (R + 0.15), 0.022, z + s1 * (R + 0.15), c0 * (R + 0.15), 0.022, z + s0 * (R + 0.15), 0xf4d03f);
  }
  S.box(0, 4.5, z, 1.3, 9, 1.3, 0xcfc6b2, { g0: 0.7, g1: 1 });
  S.blob(0, 9.8, z, 1.3, 1.3, 1.3, 0xe9c46a, 8, 5);
  obstacles.push({ x: 0, z, hw: 0.75, hl: 0.75 });
}

function pickSegmentType(rng, mix, w, last, zone, f) {
  const opts = [['shop', mix.shop], ['mid', mix.mid]];
  if (w >= 12) opts.push(['tower', mix.tower]);
  if (w >= 9 && w <= 12 && last !== 'side') opts.push(['side', mix.side * (f.sideRoad || 0.4) * 2.2]);
  if (w >= 12) opts.push(['construct', mix.construct]);
  return rng.pickWeighted(opts, (o) => o[1])[0];
}

function frontage(L, rng, zone, info, side, zA, zB) {
  const f = zone.f, mix = MIX[zone.id], zoneChunk = info.zoneChunk;
  // whole-chunk landmarks
  if (zone.id === 'mirpur' && zoneChunk === 4 && side > 0) { B.stadium(L, rng, side, zA, zB); return; }
  if (zone.id === 'mirpur' && zoneChunk === 2 && side < 0) { B.school(L, rng, zone, side, zA, zB); return; }
  const govt = zone.id === 'agargaon' && [1, 2, 6, 7].includes(zoneChunk) && (side < 0 || zoneChunk !== 1);
  let z = zA, last = '';
  while (z > zB + 1) {
    let w = snap3(rng.range(zone.width[0], zone.width[1]) * (zone.id === 'badda' ? 1.15 : 1));
    if (govt) w = 42;
    w = Math.min(w, z - zB);
    if (z - w - zB < 6) w = z - zB;
    const a = z, b = z - w;
    let type = govt ? 'govt' : pickSegmentType(rng, mix, w, last, zone, f);
    let roof = 0, zcSeg = (a + b) / 2;
    switch (type) {
      case 'govt': B.institution(L, rng, zone, side, a, b); break;
      case 'side': B.sideStreet(L, rng, zone, side, a, b); break;
      case 'construct': B.construction(L, rng, zone, side, a, b); break;
      case 'tower': roof = B.tower(L, rng, zone, side, a, b, { setback: f.stadium ? 3 : 1.5 }); break;
      case 'mid': roof = B.midrise(L, rng, zone, side, a, b); break;
      default: roof = B.shopRow(L, rng, zone, side, a, b); break;
    }
    if (roof > 0 && rng.chance((f.billboards || 0.3) * 0.7) && w >= 9) {
      P.billboard(L, side, side * (WALK_OUT + 3.5), roof + 3.6, zcSeg, Math.min(9, w - 2), 3.2, rng.pick(zone.ads));
    }
    last = type;
    z -= w;
  }
}

function sidewalkLife(L, rng, zone, side, zA, zB) {
  const f = zone.f;
  const treeProb = f.trees;
  for (let z = zB + 3; z < zA - 2; z += 9.5) {
    if (!rng.chance(treeProb)) continue;
    if (zone.id === 'mirpur') P.tree(L, side * 16.6, z + rng.range(-1.5, 1.5), rng, 'tall', 0x3f8a3c);
    else P.tree(L, side * 15.5, z + rng.range(-1.5, 1.5), rng, rng.chance(0.4) ? 'tall' : 'round', 0x4a8a3c);
  }
  const nStall = Math.round((f.stalls || 0.3) * 3.0 * (rng.f() + 0.4) * getDetail());
  for (let i = 0; i < nStall; i++) P.stall(L, side, rng.range(15.6, 16.9), rng.range(zB + 2, zA - 2), rng);
  const nPeds = Math.round((f.peds || 0.5) * 8 * (rng.f() + 0.5) * getDetail());
  P.crowd(L, side, zA, zB, rng, nPeds);
  // parked rickshaws / vans along the sidewalk edge in busy areas
  if (rng.chance(f.stalls * 0.5)) P.parkedVehicle(L, 'rickshaw', rng.int(0, 5), side * 15.1, rng.range(zB + 3, zA - 3), side < 0 ? 0.05 : Math.PI - 0.05);
}
