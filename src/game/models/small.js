// CNG auto-rickshaw, cycle rickshaw, motorcycle, bicycle.
import { newBuilder, shadowPatch, sideQuad, endQuad, wheel, person, SKIN, HAIR, SHIRT, LUNGI } from './common.js';
import { Rng } from '../utils.js';

const ART = [0xe63946, 0xffb703, 0x2a9d8f, 0x4361ee, 0xf72585, 0xff6d00, 0x7209b7, 0x06d6a0];

export function buildCNG(variant = 0) {
  const b = newBuilder(3500);
  const rng = new Rng(100 + variant);
  const body = [0x2f9e44, 0x2b8a3e, 0x1f7a8c][variant % 3];
  const roofC = [0x14301b, 0x222222, 0x103a40][variant % 3];
  shadowPatch(b, 1.45, 2.8);
  b.box(0, 0.42, 0.1, 1.22, 0.14, 2.3, 0x1d1d1d);                                  // floor
  b.box(0, 0.78, 0.05, 1.4, 0.55, 1.5, body, { g0: 0.7, g1: 1 });                  // lower tub
  b.box(0, 0.95, 0.95, 1.36, 0.6, 0.85, body, { g0: 0.7, g1: 1 });                 // engine cover (rear)
  b.box(0, 0.78, -1.05, 0.9, 0.7, 0.8, body, { g0: 0.7, g1: 1 });                  // nose pod
  b.box(0, 1.0, -1.45, 0.5, 0.18, 0.1, 0x1c1c1c);                                  // front fender
  b.box(0, 1.2, -1.2, 0.34, 0.28, 0.06, 0xfff0b0);                                 // headlight
  // roof + pillars + cage bars
  b.box(0, 1.78, 0.18, 1.42, 0.09, 1.85, roofC);
  for (const sx of [-1, 1]) for (const z of [-0.72, 0.9]) b.box(sx * 0.68, 1.35, z, 0.06, 0.86, 0.06, 0x181818);
  for (const sx of [-1, 1]) for (const y of [1.2, 1.5]) b.box(sx * 0.69, y, 0.1, 0.03, 0.03, 1.6, 0x202020);
  // seat + windshield + driver
  b.box(0, 0.98, 0.45, 1.15, 0.12, 0.55, 0x3a2a22);
  b.box(0, 1.3, 0.78, 1.15, 0.55, 0.1, 0x3a2a22);
  endQuad(b, -0.74, -0.6, 0.6, 1.12, 1.74, -1, 0x35586a);
  person(b, 0, 0.42, -0.28, { seated: true, shirt: rng.pick(SHIRT), skin: rng.pick(SKIN), hair: rng.pick(HAIR), cap: rng.chance(0.4) ? 0xf0f0f0 : undefined, scale: 0.95 });
  // colourful rear flap
  endQuad(b, 1.4, -0.65, 0.65, 0.72, 1.22, 1, rng.pick(ART));
  b.box(0, 1.0, 1.43, 0.45, 0.14, 0.02, 0xf2f2f2);                                  // plate
  b.box(-0.5, 0.9, 1.4, 0.2, 0.14, 0.05, 0xa01818); b.box(0.5, 0.9, 1.4, 0.2, 0.14, 0.05, 0xa01818);
  wheel(b, 0, 0.28, -1.1, 0.28, 0.14, 8);
  wheel(b, -0.64, 0.28, 0.95, 0.28, 0.16, 8);
  wheel(b, 0.64, 0.28, 0.95, 0.28, 0.16, 8);
  return b.toGeometry();
}

export function buildRickshaw(variant = 0) {
  const b = newBuilder(3500);
  const rng = new Rng(200 + variant);
  const hood = ART[(variant * 3) % ART.length], panel1 = ART[(variant * 3 + 1) % ART.length], panel2 = ART[(variant * 3 + 2) % ART.length];
  shadowPatch(b, 1.15, 2.6);
  b.box(0, 0.5, 0.3, 0.85, 0.06, 1.5, 0x222222);                                 // chassis plate
  b.box(0, 0.62, 0.55, 0.8, 0.14, 0.7, 0x5b3a29);                                // passenger seat
  b.box(0, 0.95, 0.88, 0.8, 0.6, 0.1, 0x5b3a29);                                 // backrest
  // folded hood (curved look: two angled slabs) and side art panels
  b.box(0, 1.42, 0.7, 0.98, 0.1, 0.85, hood, { rx: -0.35 });
  b.box(0, 1.55, 1.05, 0.98, 0.1, 0.5, hood, { rx: -0.9 });
  for (const sx of [-1, 1]) {
    sideQuad(b, sx * 0.5, 0.62, 1.05, 0.25, 1.1, sx, panel1);
    sideQuad(b, sx * 0.5 + sx * 0.004, 0.86, 0.96, 0.25, 1.1, sx, panel2);
    b.box(sx * 0.48, 1.2, 0.2, 0.05, 0.9, 0.05, 0x333333, { rz: sx * 0.15 });    // hood ribs
  }
  endQuad(b, 1.12, -0.5, 0.5, 0.6, 1.55, 1, panel2);                            // rear art plate
  endQuad(b, 1.125, -0.4, 0.4, 0.8, 1.0, 1, panel1);
  b.box(0, 0.78, 1.14, 0.3, 0.1, 0.02, 0xf2f2f2);
  // front frame, handlebar, saddle
  b.box(0, 0.78, -0.4, 0.05, 0.5, 1.2, 0x2a2a2a, { rx: 0.2 });
  b.box(0, 1.0, -0.95, 0.6, 0.04, 0.04, 0x2a2a2a);
  b.box(0, 0.78, -0.5, 0.18, 0.06, 0.3, 0x1a1a1a);
  // puller
  person(b, 0, 0.7, -0.5, { seated: true, shirt: rng.pick(SHIRT), skin: rng.pick(SKIN), hair: rng.pick(HAIR), legs: rng.pick(LUNGI), lean: 0.25, scale: 0.95 });
  // wheels (thin)
  wheel(b, -0.5, 0.36, 0.45, 0.36, 0.05, 10, 0x888888);
  wheel(b, 0.5, 0.36, 0.45, 0.36, 0.05, 10, 0x888888);
  wheel(b, 0, 0.34, -1.0, 0.34, 0.05, 10, 0x888888);
  return b.toGeometry();
}

export function buildMotorcycle(variant = 0) {
  const b = newBuilder(2500);
  const rng = new Rng(300 + variant);
  const col = [0xc1121f, 0x1d3557, 0x222222, 0x2a9d8f, 0xe85d04][variant % 5];
  shadowPatch(b, 0.8, 2.0);
  b.box(0, 0.58, 0.05, 0.22, 0.28, 0.9, 0x2b2b2b);                               // engine/frame
  b.box(0, 0.9, -0.2, 0.3, 0.26, 0.55, col);                                     // tank
  b.box(0, 0.86, 0.45, 0.3, 0.1, 0.8, 0x1c1c1c);                                 // seat
  b.box(0, 0.78, 0.9, 0.2, 0.14, 0.12, 0xa01818);                                // tail light
  b.box(0, 0.68, -0.7, 0.07, 0.8, 0.07, 0x888888, { rx: 0.35 });                 // fork
  b.box(0, 1.08, -0.82, 0.7, 0.05, 0.05, 0x222222);                              // handlebar
  b.box(0, 1.0, -0.88, 0.18, 0.18, 0.1, 0xfff0b0);                               // headlight
  wheel(b, 0, 0.33, -0.78, 0.33, 0.14, 10, 0x777777);
  wheel(b, 0, 0.33, 0.78, 0.33, 0.16, 10, 0x777777);
  const hel = rng.pick([0x1a1a1a, 0xd62828, 0xf1f1f1, 0x1d6fd1]);
  person(b, 0, 0.7, 0.3, { seated: true, shirt: rng.pick(SHIRT), skin: rng.pick(SKIN), hair: rng.pick(HAIR), helmet: rng.chance(0.7) ? hel : undefined, lean: 0.45, scale: 0.92 });
  if (rng.chance(0.4)) person(b, 0, 0.7, 0.75, { seated: true, shirt: rng.pick(SHIRT), skin: rng.pick(SKIN), hair: rng.pick(HAIR), scale: 0.85, lean: 0.1 });
  return b.toGeometry();
}

export function buildBicycle(variant = 0) {
  const b = newBuilder(2000);
  const rng = new Rng(400 + variant);
  shadowPatch(b, 0.65, 1.8);
  const fc = [0x222222, 0xb5121b, 0x1b4d8f][variant % 3];
  wheel(b, 0, 0.34, -0.62, 0.34, 0.04, 10, 0x999999);
  wheel(b, 0, 0.34, 0.62, 0.34, 0.04, 10, 0x999999);
  b.box(0, 0.62, 0.0, 0.04, 0.04, 1.2, fc, { rx: 0.1 });
  b.box(0, 0.7, -0.35, 0.04, 0.5, 0.04, fc, { rx: 0.5 });
  b.box(0, 0.7, 0.3, 0.04, 0.6, 0.04, fc, { rx: -0.2 });
  b.box(0, 0.96, -0.58, 0.5, 0.04, 0.04, 0x222222);
  b.box(0, 1.0, 0.36, 0.12, 0.05, 0.22, 0x1a1a1a);
  b.box(0, 0.62, 0.62, 0.34, 0.04, 0.5, 0x444444);                                // carrier rack
  person(b, 0, 0.72, 0.28, { seated: true, shirt: rng.pick(SHIRT), skin: rng.pick(SKIN), hair: rng.pick(HAIR), legs: rng.pick(LUNGI), lean: 0.3, scale: 0.9 });
  return b.toGeometry();
}
