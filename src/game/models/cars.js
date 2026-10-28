// Cars (sedan / microbus / SUV), trucks and police pickups.
import { newBuilder, shadowPatch, sideQuad, endQuad, slopeFront, slopeBack, wheel, person, SKIN, HAIR, SHIRT } from './common.js';
import { Rng } from '../utils.js';

const CAR_COLORS = [0xefefef, 0xd4d6d9, 0x2a2c30, 0xb3202a, 0x1f4fa0, 0xe9c71b, 0x8a8d91, 0x3a6a46];
const GLASS = 0x28414f;

export function buildCar(variant = 0) {
  const kind = variant % 3; // 0 sedan, 1 microbus (Hiace style), 2 SUV
  const color = CAR_COLORS[Math.floor(variant / 3) % CAR_COLORS.length];
  const rng = new Rng(500 + variant);
  const b = newBuilder(4500);
  const w = 1.9, l = kind === 1 ? 5.0 : 4.5, hw = w / 2, zf = -l / 2, zr = l / 2;
  shadowPatch(b, w, l);
  b.box(0, 0.38, 0, w - 0.2, 0.3, l - 0.3, 0x1a1a1a);
  if (kind === 1) {
    b.box(0, 0.95, 0, w, 0.95, l, color, { g0: 0.7, g1: 1 });                    // body
    b.box(0, 1.75, 0.35, w - 0.04, 0.78, l - 1.1, color);                          // tall cabin
    slopeFront(b, -hw + 0.08, hw - 0.08, zf + 0.5, 1.4, zf + 0.78, 2.1, GLASS);
    for (const sx of [-1, 1]) {
      sideQuad(b, sx * (hw - 0.015), 1.45, 2.05, zf + 1.1, zr - 0.35, sx, GLASS);
      for (let z = zf + 1.9; z < zr - 0.5; z += 0.95) sideQuad(b, sx * (hw - 0.012), 1.45, 2.05, z, z + 0.08, sx, color);
    }
    endQuad(b, zr + 0.003, -hw + 0.12, hw - 0.12, 1.5, 2.1, 1, GLASS);
    b.box(0, 2.18, 0.35, w - 0.3, 0.08, l - 1.5, 0xf5f5f5);
  } else if (kind === 2) {
    b.box(0, 0.98, 0, w, 0.88, l, color, { g0: 0.72, g1: 1 });
    b.box(0, 1.6, 0.35, w - 0.1, 0.62, l - 1.4, color);
    slopeFront(b, -hw + 0.1, hw - 0.1, zf + 1.0, 1.3, zf + 1.35, 1.85, GLASS);
    for (const sx of [-1, 1]) sideQuad(b, sx * (hw - 0.065), 1.32, 1.82, zf + 1.45, zr - 0.7, sx, GLASS);
    slopeBack(b, -hw + 0.1, hw - 0.1, zr - 0.3, 1.3, zr - 0.65, 1.85, GLASS);
    b.box(0, 1.95, 0.35, w - 0.3, 0.05, l - 1.8, 0x222222);                          // roof rails
  } else {
    b.box(0, 0.78, 0, w, 0.62, l, color, { g0: 0.72, g1: 1 });                       // lower
    b.box(0, 0.92, zf + 0.7, w - 0.06, 0.2, 1.3, color);                             // bonnet
    b.box(0, 1.3, 0.35, w - 0.12, 0.48, 2.5, color);                                 // cabin
    slopeFront(b, -hw + 0.12, hw - 0.12, zf + 1.35, 1.05, zf + 1.85, 1.52, GLASS);
    slopeBack(b, -hw + 0.12, hw - 0.12, zr - 0.5, 1.05, zr - 0.95, 1.52, GLASS);
    for (const sx of [-1, 1]) sideQuad(b, sx * (hw - 0.065), 1.1, 1.52, zf + 1.9, zr - 1.0, sx, GLASS);
    b.box(0, 1.56, 0.35, w - 0.3, 0.04, 2.3, 0xdddddd);
  }
  // lights, plate, bumpers
  b.box(-hw + 0.28, 0.82, zf - 0.01, 0.4, 0.14, 0.04, 0xfff3c0);
  b.box(hw - 0.28, 0.82, zf - 0.01, 0.4, 0.14, 0.04, 0xfff3c0);
  b.box(0, 0.62, zf - 0.04, w - 0.1, 0.18, 0.1, 0x25262a);
  b.box(0, 0.62, zr + 0.04, w - 0.1, 0.18, 0.1, 0x25262a);
  b.box(-hw + 0.28, 0.85, zr + 0.01, 0.4, 0.14, 0.04, 0xb3171d);
  b.box(hw - 0.28, 0.85, zr + 0.01, 0.4, 0.14, 0.04, 0xb3171d);
  b.box(0, 0.7, zr + 0.02, 0.5, 0.14, 0.02, 0xf2f2f2);
  for (const sx of [-1, 1]) b.box(sx * (hw + 0.1), 1.05, zf + 1.2, 0.12, 0.1, 0.16, 0x1a1a1a);   // mirrors
  // dark driver (right-hand drive) silhouette
  person(b, 0.4, 0.5, -0.1 + (kind === 1 ? -0.6 : 0.2), { seated: true, shirt: rng.pick(SHIRT), skin: rng.pick(SKIN), hair: rng.pick(HAIR), scale: 0.8 });
  const wz = kind === 1 ? 1.55 : 1.4;
  for (const sx of [-1, 1]) { wheel(b, sx * (hw - 0.12), 0.34, zf + wz, 0.34, 0.22, 10); wheel(b, sx * (hw - 0.12), 0.34, zr - wz, 0.34, 0.22, 10); }
  return b.toGeometry();
}

export function buildTruck(variant = 0) {
  const b = newBuilder(6000);
  const rng = new Rng(600 + variant);
  const cab = [0x1565c0, 0xc62828, 0x2e7d32, 0xef6c00][variant % 4];
  const accent = [0xffd54f, 0xffffff, 0xffab00, 0x1a1a1a][variant % 4];
  const w = 2.5, l = 8.2, hw = w / 2, zf = -l / 2, zr = l / 2;
  shadowPatch(b, w, l);
  b.box(0, 0.7, 0, w - 0.4, 0.36, l - 0.4, 0x1c1c1c);                               // chassis
  // cab
  b.box(0, 1.5, zf + 1.4, w - 0.1, 1.5, 2.3, cab, { g0: 0.7, g1: 1 });
  b.box(0, 2.35, zf + 1.55, w - 0.2, 0.2, 2.0, cab);
  endQuad(b, zf + 0.245, -hw + 0.2, hw - 0.2, 1.55, 2.3, -1, GLASS);
  for (const sx of [-1, 1]) sideQuad(b, sx * (hw - 0.04), 1.6, 2.25, zf + 0.7, zf + 1.75, sx, GLASS);
  endQuad(b, zf + 0.24, -hw + 0.05, hw - 0.05, 0.95, 1.4, -1, 0x202226);             // grille
  for (let g = 0; g < 3; g++) b.box(0, 1.05 + g * 0.14, zf + 0.22, w - 0.3, 0.04, 0.03, 0xcfcfcf);
  b.box(0, 0.72, zf + 0.1, w + 0.05, 0.28, 0.3, 0x2a2a2a);
  b.box(-hw + 0.35, 1.2, zf + 0.22, 0.34, 0.26, 0.05, 0xfff0b0);
  b.box(hw - 0.35, 1.2, zf + 0.22, 0.34, 0.26, 0.05, 0xfff0b0);
  b.box(0, 1.42, zf + 0.22, 1.0, 0.16, 0.03, accent);
  for (const sx of [-1, 1]) {
    sideQuad(b, sx * (hw - 0.045), 1.0, 1.12, zf + 0.3, zf + 2.5, sx, accent);
    b.box(sx * (hw + 0.1), 2.0, zf + 0.5, 0.1, 0.4, 0.14, 0x1a1a1a);               // mirrors
  }
  // cargo bed
  const type = variant % 2;
  if (type === 0) {
    // open flatbed with heaped cargo (sacks / bricks) and wooden sides
    b.box(0, 1.05, zr - 2.6, w, 0.16, 5.3, 0x7a5a3a);
    for (const sx of [-1, 1]) b.box(sx * (hw - 0.05), 1.55, zr - 2.6, 0.1, 0.9, 5.3, 0x8a6a45);
    b.box(0, 1.55, zr - 0.1, w, 0.9, 0.1, 0x8a6a45);
    b.box(0, 1.55, zr - 5.3, w, 0.9, 0.1, 0x8a6a45);
    for (let i = 0; i < 5; i++) b.box(rng.range(-0.6, 0.6), 2.15 + (i % 2) * 0.3, zr - 0.9 - i * 0.95, rng.range(1.0, 1.6), 0.7, 0.85, rng.pick([0xb59a6a, 0x9c4a30, 0xd8d0b8, 0x4c6a8a]));
  } else {
    // box truck with painted art panels
    b.box(0, 1.05, zr - 2.6, w, 0.16, 5.3, 0x2a2a2a);
    b.box(0, 2.15, zr - 2.6, w - 0.04, 2.1, 5.3, rng.pick([0xe8e2d0, 0xcfd8dc, 0xf2d27a]), { g0: 0.7, g1: 1 });
    for (const sx of [-1, 1]) {
      sideQuad(b, sx * (hw - 0.015), 1.3, 1.8, zr - 5.2, zr - 0.1, sx, cab);
      sideQuad(b, sx * (hw - 0.015), 2.3, 2.5, zr - 5.2, zr - 0.1, sx, accent);
      sideQuad(b, sx * (hw - 0.015), 1.85, 2.2, zr - 4.2, zr - 1.2, sx, rng.pick([0xe63946, 0xf4a261, 0x2a9d8f]));
    }
    endQuad(b, zr + 0.004, -hw + 0.1, hw - 0.1, 1.3, 3.0, 1, cab);
    endQuad(b, zr + 0.008, -0.8, 0.8, 1.6, 2.4, 1, accent);
  }
  b.box(-hw + 0.35, 1.1, zr + 0.02, 0.34, 0.2, 0.05, 0xa81818);
  b.box(hw - 0.35, 1.1, zr + 0.02, 0.34, 0.2, 0.05, 0xa81818);
  b.box(0, 0.85, zr + 0.05, w, 0.3, 0.2, 0x2a2a2a);
  for (const sx of [-1, 1]) {
    wheel(b, sx * (hw - 0.14), 0.52, zf + 1.5, 0.52, 0.3, 10);
    wheel(b, sx * (hw - 0.14), 0.52, zr - 1.6, 0.52, 0.3, 10);
    wheel(b, sx * (hw - 0.5), 0.52, zr - 1.6, 0.52, 0.26, 10);
  }
  person(b, 0.5, 1.15, zf + 1.1, { seated: true, shirt: rng.pick(SHIRT), skin: rng.pick(SKIN), hair: rng.pick(HAIR), scale: 0.9 });
  return b.toGeometry();
}

/** Police pickup (blue/white livery). Light bar halves are separate meshes created by the Vehicle class. */
export function buildPolice() {
  const b = newBuilder(5000);
  const w = 2.0, l = 5.0, hw = w / 2, zf = -l / 2, zr = l / 2;
  const blue = 0x15306f, white = 0xf1f3f5;
  shadowPatch(b, w, l);
  b.box(0, 0.4, 0, w - 0.2, 0.3, l - 0.3, 0x1a1a1a);
  b.box(0, 0.98, 0, w, 0.8, l, blue, { g0: 0.7, g1: 1 });
  b.box(0, 1.1, zf + 0.75, w - 0.04, 0.12, 1.3, blue);                               // bonnet
  b.box(0, 1.55, zf + 2.15, w - 0.1, 0.65, 1.9, blue);                               // cab
  b.box(0, 1.91, zf + 2.15, w - 0.2, 0.08, 1.8, white);                              // white roof
  slopeFront(b, -hw + 0.1, hw - 0.1, zf + 1.2, 1.3, zf + 1.65, 1.85, GLASS);
  slopeBack(b, -hw + 0.1, hw - 0.1, zf + 3.2, 1.3, zf + 3.0, 1.85, GLASS);
  for (const sx of [-1, 1]) {
    sideQuad(b, sx * (hw - 0.07), 1.33, 1.82, zf + 1.7, zf + 3.0, sx, GLASS);
    sideQuad(b, sx * (hw + 0.004), 0.9, 1.25, zf + 1.0, zf + 3.4, sx, white);       // white door stripe
    sideQuad(b, sx * (hw + 0.006), 0.82, 0.88, zf + 0.2, zr - 0.2, sx, 0xd62828);
    b.box(sx * (hw + 0.1), 1.35, zf + 1.4, 0.12, 0.1, 0.16, 0x1a1a1a);
  }
  // rear bed with roll bar
  b.box(0, 1.1, zr - 0.9, w - 0.1, 0.16, 1.5, 0x232323);
  b.box(0, 1.35, zr - 0.9, 0.06, 0.55, 1.4, 0x2a2a2a);
  for (const sx of [-1, 1]) { b.box(sx * 0.9, 1.45, zr - 0.5, 0.07, 0.8, 0.07, 0x2a2a2a); b.box(sx * 0.9, 1.45, zr - 1.3, 0.07, 0.8, 0.07, 0x2a2a2a); }
  b.box(0, 1.8, zr - 0.9, 1.8, 0.07, 0.07, 0x2a2a2a);
  // lights/bumpers
  b.box(-hw + 0.3, 1.0, zf - 0.01, 0.4, 0.2, 0.05, 0xfff0b0);
  b.box(hw - 0.3, 1.0, zf - 0.01, 0.4, 0.2, 0.05, 0xfff0b0);
  b.box(0, 0.62, zf - 0.08, w, 0.22, 0.2, 0x25262a);
  b.box(0, 0.9, zf - 0.1, 1.2, 0.06, 0.05, 0xcfcfcf);                                // bull bar
  b.box(-hw + 0.25, 0.95, zr + 0.01, 0.3, 0.16, 0.04, 0xb3171d);
  b.box(hw - 0.25, 0.95, zr + 0.01, 0.3, 0.16, 0.04, 0xb3171d);
  b.box(0, 0.62, zr + 0.06, w, 0.22, 0.12, 0x25262a);
  b.box(0, 1.98, zf + 2.05, 1.5, 0.06, 0.5, 0x15151a);                               // light-bar base
  for (const sx of [-1, 1]) { wheel(b, sx * (hw - 0.12), 0.38, zf + 1.1, 0.38, 0.24, 10); wheel(b, sx * (hw - 0.12), 0.38, zr - 1.0, 0.38, 0.24, 10); }
  return b.toGeometry();
}

export const POLICE_LIGHT = { y: 2.1, z: -0.0 + (-5.0 / 2 + 2.05), xOff: 0.42, size: [0.62, 0.14, 0.34] };
