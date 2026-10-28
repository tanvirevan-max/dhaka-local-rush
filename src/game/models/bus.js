// Bangladeshi local bus: boxy body, open windows with passengers, roof rack, bold paint, door + footboard on the LEFT.
import { newBuilder, shadowPatch, sideQuad, endQuad, wheel, SKIN, HAIR, SHIRT, TIRE } from './common.js';
import { Rng } from '../utils.js';

const WIN_TOP = 2.62, WIN_BOT = 1.78;

/**
 * Returns { geometry, dims } for a bus body WITHOUT wheels (wheels are separate meshes on the player bus,
 * and baked in for traffic buses via opts.bakeWheels).
 * pal = { color, accent, trim, roof }
 */
export function buildBusGeometry(w, l, pal, opts = {}) {
  const b = newBuilder(14000);
  const rng = new Rng(opts.seed ?? 7);
  const hw = w / 2, zf = -l / 2, zr = l / 2;
  const { color: body, accent, trim, roof } = pal;
  const dark = 0x17181b, chrome = 0xd5d8dc, interior = 0x2b2420;
  const doorZ0 = zf + 0.55, doorZ1 = zf + 2.05;       // door opening (left side)

  if (opts.shadow !== false) shadowPatch(b, w, l);
  // undercarriage + axles
  b.box(0, 0.62, 0, w - 0.25, 0.42, l - 0.5, 0x1a1a1a);
  // lower body (main colour, grime gradient)
  b.box(0, 1.28, 0, w, 1.0, l, body, { g0: 0.62, g1: 1.0 });
  // wheel arches (dark)
  for (const zz of [zf + 1.95, zr - 1.9]) for (const sx of [-1, 1]) b.box(sx * (hw + 0.012), 0.82, zz, 0.04, 0.75, 1.25, dark);

  // window band: interior + frame
  b.box(0, (WIN_TOP + WIN_BOT) / 2, 0, w - 0.22, WIN_TOP - WIN_BOT, l - 0.4, interior, { f: 63 });
  // top band above windows (body colour)
  b.box(0, 2.84, 0, w, 0.44, l, body, { g0: 0.95, g1: 1 });
  // roof (light colour) slightly narrower with a drip edge
  b.box(0, 3.12, 0, w - 0.1, 0.14, l - 0.06, roof);
  // pillars between windows (both sides), skipping the door opening on the left
  const winW = 1.12;
  const nWin = Math.floor((l - 1.0) / (winW + 0.14));
  const startZ = zf + 0.55;
  for (let i = 0; i <= nWin; i++) {
    const pz = startZ + i * (winW + 0.14);
    if (pz > zr - 0.3) break;
    for (const sx of [-1, 1]) {
      if (sx < 0 && pz > doorZ0 - 0.08 && pz < doorZ1 + 0.08) continue;
      b.box(sx * (hw - 0.02), (WIN_TOP + WIN_BOT) / 2, pz, 0.13, WIN_TOP - WIN_BOT + 0.02, 0.14, body);
    }
  }
  // window sill rail + safety bars (thin dark verticals) in some windows
  for (const sx of [-1, 1]) {
    b.box(sx * (hw - 0.01), WIN_BOT + 0.02, 0, 0.1, 0.05, l - 0.5, trim);
  }
  // passengers (heads + shoulders) inside, open windows
  const seatRows = nWin;
  for (let i = 0; i < seatRows; i++) {
    const pz = startZ + 0.14 + winW * 0.5 + i * (winW + 0.14);
    for (const sx of [-1, 1]) {
      if (sx < 0 && pz > doorZ0 - 0.3 && pz < doorZ1 + 0.3) continue;
      if (!rng.chance(0.62)) continue;
      const px = sx * (hw - 0.42 + rng.range(-0.04, 0.04));
      const shirtC = rng.pick(SHIRT);
      b.box(px, WIN_BOT + 0.2, pz, 0.28, 0.4, 0.42, shirtC);
      b.blob(px, WIN_BOT + 0.56, pz, 0.14, 0.17, 0.14, rng.pick(SKIN), 6, 4);
      b.blob(px, WIN_BOT + 0.64, pz, 0.145, 0.1, 0.145, rng.pick(HAIR), 6, 3);
      if (rng.chance(0.14)) b.box(sx * (hw + 0.02), WIN_BOT + 0.12, pz + 0.3, 0.07, 0.07, 0.5, SKIN[1], { rx: 0.3 }); // arm out of the window
    }
  }
  // seat backs hint (lighter strip) so the interior is not a black void
  b.box(0, WIN_BOT + 0.1, 0, w - 0.5, 0.18, l - 1.0, 0x6b4a3a, { f: 4 });

  // paint scheme: two horizontal stripes + small diamonds (rickshaw-art style)
  for (const sx of [-1, 1]) {
    const x = sx * (hw + 0.012);
    sideQuad(b, x, 1.12, 1.34, zf + 0.1, zr - 0.1, sx, accent);
    sideQuad(b, x, 1.44, 1.52, zf + 0.1, zr - 0.1, sx, trim);
    sideQuad(b, x, 0.78, 0.9, zf + 0.1, zr - 0.1, sx, trim);
    for (let z = zf + 0.6; z < zr - 0.5; z += 0.95) {
      if (sx < 0 && z > doorZ0 - 0.5 && z < doorZ1 + 0.4) continue;
      b.box(x + sx * 0.005, 1.23, z, 0.03, 0.2, 0.2, trim, { rx: Math.PI / 4 });
    }
    // dents / scratches (dark patches)
    for (let k = 0; k < 4; k++) {
      const dz = rng.range(zf + 1.5, zr - 1);
      if (sx < 0 && dz > doorZ0 - 0.5 && dz < doorZ1 + 0.6) continue;
      sideQuad(b, x + sx * 0.008, 0.95 + rng.range(0, 0.5), 1.08 + rng.range(0, 0.6), dz, dz + rng.range(0.25, 0.8), sx, 0x000000);
    }
  }
  // door opening on the left (kerb side): dark recess + footboard + grab rails
  sideQuad(b, -hw - 0.014, 0.7, 2.62, doorZ0, doorZ1, -1, 0x120f0d);
  b.box(-hw - 0.2, 0.5, (doorZ0 + doorZ1) / 2, 0.42, 0.08, doorZ1 - doorZ0, 0x2d2d30);       // step 1
  b.box(-hw - 0.1, 0.9, (doorZ0 + doorZ1) / 2, 0.24, 0.07, doorZ1 - doorZ0, 0x2d2d30);       // step 2
  b.box(-hw + 0.01, 1.75, doorZ0 + 0.03, 0.06, 1.9, 0.06, chrome);                           // front door pole
  b.box(-hw + 0.01, 1.75, doorZ1 - 0.03, 0.06, 1.9, 0.06, chrome);                           // rear door pole
  b.box(-hw - 0.01, 2.55, (doorZ0 + doorZ1) / 2, 0.06, 0.05, doorZ1 - doorZ0, chrome);       // top rail

  // front face: windshield, grille, bumper, headlights, plate
  endQuad(b, zf - 0.006, -hw + 0.12, hw - 0.12, 1.84, 2.72, -1, 0x35586a);                    // big windshield
  endQuad(b, zf - 0.007, -0.02, 0.02, 1.84, 2.72, -1, 0x1a1a1a);                              // centre divider
  endQuad(b, zf - 0.006, -hw + 0.1, hw - 0.1, 2.72, 3.0, -1, accent);                         // destination board strip
  b.box(0, 1.2, zf - 0.015, w - 0.5, 0.5, 0.03, 0x24262a);                                    // grille
  for (let g = 0; g < 4; g++) b.box(0, 1.02 + g * 0.12, zf - 0.04, w - 0.6, 0.035, 0.02, chrome);
  b.box(0, 0.62, zf - 0.12, w + 0.06, 0.26, 0.3, 0x2a2b2f);                                   // bumper
  b.box(0, 0.62, zf - 0.28, w - 0.4, 0.05, 0.05, chrome);
  b.box(0, 0.88, zf - 0.034, 0.5, 0.17, 0.02, 0xf1f1f1);                                      // number plate
  b.box(-hw + 0.3, 1.2, zf - 0.04, 0.34, 0.3, 0.06, 0xfff1b8);                                // headlights
  b.box(hw - 0.3, 1.2, zf - 0.04, 0.34, 0.3, 0.06, 0xfff1b8);
  // side mirrors on long stays
  for (const sx of [-1, 1]) {
    b.box(sx * (hw + 0.22), 2.2, zf + 0.35, 0.5, 0.04, 0.04, 0x222222);
    b.box(sx * (hw + 0.5), 2.2, zf + 0.35, 0.06, 0.34, 0.2, 0x222222);
  }
  // rear face
  endQuad(b, zr + 0.006, -hw + 0.15, hw - 0.15, 1.9, 2.62, 1, 0x33566a);                      // rear window
  endQuad(b, zr + 0.006, -hw + 0.1, hw - 0.1, 1.0, 1.8, 1, trim);                             // rear art panel (banner overlays this)
  b.box(0, 0.62, zr + 0.12, w + 0.06, 0.26, 0.3, 0x2a2b2f);                                    // rear bumper
  b.box(-hw + 0.25, 1.05, zr + 0.03, 0.34, 0.2, 0.06, 0x9d1b1b);                              // tail lights
  b.box(hw - 0.25, 1.05, zr + 0.03, 0.34, 0.2, 0.06, 0x9d1b1b);
  b.box(0, 0.95, zr + 0.04, 0.5, 0.17, 0.02, 0xf1f1f1);
  // exhaust (rear right, low)
  b.cylX(hw - 0.5, 0.5, zr + 0.25, 0.07, 0.5, 6, 0x303030);
  // mud flaps
  for (const sx of [-1, 1]) b.box(sx * (hw - 0.3), 0.42, zr - 1.2, 0.5, 0.45, 0.04, 0x1d1d1d);

  // roof rack with luggage
  b.box(-hw + 0.25, 3.28, 0, 0.04, 0.2, l - 0.8, 0x2c2c2c);
  b.box(hw - 0.25, 3.28, 0, 0.04, 0.2, l - 0.8, 0x2c2c2c);
  if (opts.luggage !== false) {
    const nBags = rng.int(2, 4);
    for (let i = 0; i < nBags; i++) {
      const bz = zf + 1.5 + i * ((l - 3) / nBags) + rng.range(-0.3, 0.3);
      const bc = rng.pick([0xb59a6a, 0x3a6ea5, 0x8a6d3b, 0xc0392b, 0xd8d0b8]);
      b.box(rng.range(-0.4, 0.4), 3.4, bz, rng.range(0.8, 1.4), rng.range(0.3, 0.55), rng.range(0.7, 1.1), bc, { ry: rng.range(-0.2, 0.2) });
    }
  }
  // roof ventilator + AC-less hatch
  b.box(0.4, 3.24, zr - 1.8, 0.6, 0.1, 0.6, 0xd9d9d9);

  if (opts.bakeWheels) {
    for (const sx of [-1, 1]) {
      wheel(b, sx * (hw - 0.12), 0.55, zf + 1.95, 0.55, 0.3);
      wheel(b, sx * (hw - 0.12), 0.55, zr - 1.9, 0.55, 0.3);
      wheel(b, sx * (hw - 0.45), 0.55, zr - 1.9, 0.55, 0.26);
    }
  }
  return { geometry: b.toGeometry(), dims: { w, l, doorZ0, doorZ1 } };
}

/** Wheel geometry for the player bus (front: single, rear: dual). Axis along X, centred at origin. */
export function buildBusWheel(dual = false) {
  const b = newBuilder(600);
  const r = 0.55;
  if (dual) {
    b.cylX(-0.2, 0, 0, r, 0.26, 12, TIRE, 0x777777);
    b.cylX(0.2, 0, 0, r, 0.26, 12, TIRE, 0x777777);
    b.cylX(0, 0, 0, r * 0.55, 0.5, 8, 0x8a8a8a);
  } else {
    b.cylX(0, 0, 0, r, 0.32, 12, TIRE, 0xc8c8c8);
    b.cylX(0, 0, 0, r * 0.6, 0.34, 8, 0x9a9a9a, 0xd0d0d0);
  }
  // lug nuts / spoke hint so rotation is visible
  b.box(0, 0, 0, dual ? 0.56 : 0.34, 0.12, r * 1.5, 0xb5b5b5, { f: 63 });
  b.box(0, 0, 0, dual ? 0.56 : 0.34, r * 1.5, 0.12, 0xb5b5b5, { f: 63 });
  return b.toGeometry();
}
