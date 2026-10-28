// GeoBuilder: writes flat-shaded, vertex-coloured geometry into pre-allocated typed arrays.
// Used both for one-off vehicle models (call toGeometry()) and for the streamed road chunks
// (call reset() + build + commit(mesh)), so chunk streaming allocates nothing per frame.
import * as THREE from 'three';

// Sign atlas cells ([u0,v0,u1,v1]) registered by the Environment once the atlas texture exists.
// Builders accept either a cell array or a numeric sign index (see config/signs.js).
let ATLAS_CELLS = null;
export function setAtlasCells(cells) { ATLAS_CELLS = cells; }
export function resolveCell(c) { return typeof c === 'number' ? (ATLAS_CELLS ? ATLAS_CELLS[c] : [0, 0, 0.01, 0.01]) : c; }

const colorCache = new Map();
/** Cached THREE.Color for a hex value. Never mutate the returned object. */
export function col(hex) {
  let c = colorCache.get(hex);
  if (!c) { c = new THREE.Color(hex); colorCache.set(hex, c); }
  return c;
}

/** Multiply a hex colour by a brightness factor, returns a number (sRGB hex). */
export function shade(hex, m) {
  const r = Math.min(255, Math.max(0, Math.round(((hex >> 16) & 255) * m)));
  const g = Math.min(255, Math.max(0, Math.round(((hex >> 8) & 255) * m)));
  const b = Math.min(255, Math.max(0, Math.round((hex & 255) * m)));
  return (r << 16) | (g << 8) | b;
}

export function mixHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

// Face bit flags for box()
export const F = { PX: 1, NX: 2, PY: 4, NY: 8, PZ: 16, NZ: 32, SIDES: 1 | 2 | 16 | 32, NO_BOTTOM: 1 | 2 | 4 | 16 | 32, ALL: 63 };

// Cube corner index: bit0 = +x, bit1 = +y, bit2 = +z
const ci = (x, y, z) => x | (y << 1) | (z << 2);
// Each face lists 4 corners, counter-clockwise seen from outside.
const FACES = [
  [F.PX, ci(1, 0, 1), ci(1, 0, 0), ci(1, 1, 0), ci(1, 1, 1), 0],
  [F.NX, ci(0, 0, 0), ci(0, 0, 1), ci(0, 1, 1), ci(0, 1, 0), 0],
  [F.PY, ci(0, 1, 1), ci(1, 1, 1), ci(1, 1, 0), ci(0, 1, 0), 1],
  [F.NY, ci(0, 0, 0), ci(1, 0, 0), ci(1, 0, 1), ci(0, 0, 1), 1],
  [F.PZ, ci(0, 0, 1), ci(1, 0, 1), ci(1, 1, 1), ci(0, 1, 1), 0],
  [F.NZ, ci(1, 0, 0), ci(0, 0, 0), ci(0, 1, 0), ci(1, 1, 0), 0],
];

const _corner = new Float64Array(24);

export class GeoBuilder {
  constructor(maxVerts = 20000) {
    this.max = maxVerts;
    this.pos = new Float32Array(maxVerts * 3);
    this.nor = new Float32Array(maxVerts * 3);
    this.clr = new Float32Array(maxVerts * 3);
    this.uv = new Float32Array(maxVerts * 2);
    this.idx = new Uint32Array(Math.ceil(maxVerts * 1.5) + 12);
    this.v = 0;
    this.i = 0;
    this.overflowed = false;
  }

  reset() { this.v = 0; this.i = 0; this.overflowed = false; }

  /** Low-level quad (a,b,c,d counter-clockwise from the visible side), scalar args, zero allocation. */
  q(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, hex, u0 = 0, v0 = 0, u1 = 0, v1 = 0, m0 = 1, m1 = 1, m2 = 1, m3 = 1, uvMode = 0, uvW = 3, uvH = 3.2) {
    if (this.v + 4 > this.max) { this.overflowed = true; return; }
    const ex = bx - ax, ey = by - ay, ez = bz - az;
    const fx = cx - ax, fy = cy - ay, fz = cz - az;
    let nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const c = col(hex);
    const v = this.v;
    const p = this.pos, n = this.nor, k = this.clr, t = this.uv;
    const set = (o, x, y, z, m) => {
      p[o * 3] = x; p[o * 3 + 1] = y; p[o * 3 + 2] = z;
      n[o * 3] = nx; n[o * 3 + 1] = ny; n[o * 3 + 2] = nz;
      k[o * 3] = c.r * m; k[o * 3 + 1] = c.g * m; k[o * 3 + 2] = c.b * m;
    };
    set(v, ax, ay, az, m0); set(v + 1, bx, by, bz, m1); set(v + 2, cx, cy, cz, m2); set(v + 3, dx, dy, dz, m3);
    if (uvMode === 1) {
      // world-space facade mapping (windows tile in metres)
      const horiz = Math.abs(nx) > Math.abs(nz);
      const side = Math.abs(ny) < 0.5;
      const uf = (x, y, z) => (side ? (horiz ? z : x) / uvW : x / uvW);
      const vf = (x, y, z) => (side ? y / uvH : z / uvH);
      t[v * 2] = uf(ax, ay, az); t[v * 2 + 1] = vf(ax, ay, az);
      t[v * 2 + 2] = uf(bx, by, bz); t[v * 2 + 3] = vf(bx, by, bz);
      t[v * 2 + 4] = uf(cx, cy, cz); t[v * 2 + 5] = vf(cx, cy, cz);
      t[v * 2 + 6] = uf(dx, dy, dz); t[v * 2 + 7] = vf(dx, dy, dz);
    } else {
      t[v * 2] = u0; t[v * 2 + 1] = v0;
      t[v * 2 + 2] = u1; t[v * 2 + 3] = v0;
      t[v * 2 + 4] = u1; t[v * 2 + 5] = v1;
      t[v * 2 + 6] = u0; t[v * 2 + 7] = v1;
    }
    const i = this.i, ix = this.idx;
    ix[i] = v; ix[i + 1] = v + 1; ix[i + 2] = v + 2;
    ix[i + 3] = v; ix[i + 4] = v + 2; ix[i + 5] = v + 3;
    this.v += 4; this.i += 6;
  }

  /** Quad from point arrays. uv = [u0,v0,u1,v1] optional. */
  quad(a, b, c, d, hex, uv) {
    if (uv) this.q(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2], hex, uv[0], uv[1], uv[2], uv[3]);
    else this.q(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2], hex);
  }

  /** Flat horizontal rectangle at height y (visible from above). x0<x1, z0<z1 */
  floor(x0, x1, z0, z1, y, hex) {
    this.q(x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0, hex);
  }

  /**
   * Box centred on (cx,cy,cz) with full sizes sx,sy,sz.
   * o: { rx, ry, rz (radians), f (face mask), g0, g1 (bottom/top brightness on side faces), facade:[w,h] }
   */
  box(cx, cy, cz, sx, sy, sz, hex, o) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const rx = o && o.rx || 0, ry = o && o.ry || 0, rz = o && o.rz || 0;
    const mask = o && o.f !== undefined ? o.f : F.NO_BOTTOM;
    const g0 = o && o.g0 !== undefined ? o.g0 : 1;
    const g1 = o && o.g1 !== undefined ? o.g1 : 1;
    const fac = o && o.facade;
    const rotated = rx !== 0 || ry !== 0 || rz !== 0;
    let m00 = 1, m01 = 0, m02 = 0, m10 = 0, m11 = 1, m12 = 0, m20 = 0, m21 = 0, m22 = 1;
    if (rotated) {
      const a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry), e = Math.cos(rz), f = Math.sin(rz);
      // R = Rz * Ry * Rx
      m00 = c * e; m01 = -c * f; m02 = d;
      m10 = a * f + b * d * e; m11 = a * e - b * d * f; m12 = -b * c;
      m20 = b * f - a * d * e; m21 = b * e + a * d * f; m22 = a * c;
    }
    for (let k = 0; k < 8; k++) {
      const x = (k & 1 ? hx : -hx), y = (k & 2 ? hy : -hy), z = (k & 4 ? hz : -hz);
      _corner[k * 3] = cx + m00 * x + m01 * y + m02 * z;
      _corner[k * 3 + 1] = cy + m10 * x + m11 * y + m12 * z;
      _corner[k * 3 + 2] = cz + m20 * x + m21 * y + m22 * z;
    }
    for (let fi = 0; fi < 6; fi++) {
      const face = FACES[fi];
      if (!(mask & face[0])) continue;
      const a = face[1] * 3, b = face[2] * 3, c = face[3] * 3, d = face[4] * 3;
      const horizontal = face[5] === 1;
      const ya = _corner[a + 1], yb = _corner[b + 1], yc = _corner[c + 1], yd = _corner[d + 1];
      // vertical gradient on side faces: darker at the bottom (road grime)
      let m0 = 1, m1 = 1, m2 = 1, m3 = 1;
      if (!horizontal && (g0 !== 1 || g1 !== 1)) {
        const lo = cy - hy, span = sy || 1;
        const mf = (y) => g0 + (g1 - g0) * Math.min(1, Math.max(0, (y - lo) / span));
        m0 = mf(ya); m1 = mf(yb); m2 = mf(yc); m3 = mf(yd);
      }
      this.q(_corner[a], ya, _corner[a + 2], _corner[b], yb, _corner[b + 2], _corner[c], yc, _corner[c + 2], _corner[d], yd, _corner[d + 2],
        hex, 0, 0, 0, 0, m0, m1, m2, m3, fac ? 1 : 0, fac ? fac[0] : 3, fac ? fac[1] : 3.2);
    }
  }

  /** Cylinder with axis along X (wheels). */
  cylX(cx, cy, cz, r, len, seg, hex, capHex) {
    const hl = len / 2;
    const cap = capHex === undefined ? hex : capHex;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const y0 = cy + Math.sin(a0) * r, z0 = cz + Math.cos(a0) * r;
      const y1 = cy + Math.sin(a1) * r, z1 = cz + Math.cos(a1) * r;
      this.q(cx - hl, y0, z0, cx - hl, y1, z1, cx + hl, y1, z1, cx + hl, y0, z0, hex);
      this.tri(cx + hl, cy, cz, cx + hl, y0, z0, cx + hl, y1, z1, cap);
      this.tri(cx - hl, cy, cz, cx - hl, y1, z1, cx - hl, y0, z0, cap);
    }
  }

  /** Cylinder / cone with axis along Y. r2 = top radius (defaults to r). */
  cylY(cx, cy, cz, r, h, seg, hex, r2) {
    const rt = r2 === undefined ? r : r2;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      this.q(cx + c1 * r, cy, cz + s1 * r, cx + c0 * r, cy, cz + s0 * r, cx + c0 * rt, cy + h, cz + s0 * rt, cx + c1 * rt, cy + h, cz + s1 * rt, hex);
      if (rt > 0.001) this.tri(cx, cy + h, cz, cx + c1 * rt, cy + h, cz + s1 * rt, cx + c0 * rt, cy + h, cz + s0 * rt, hex);
    }
  }

  /** Low-poly blob (heads, tree crowns, bushes). Polar caps use triangles (a quad there would have a zero normal). */
  blob(cx, cy, cz, rx, ry, rz, hex, seg = 6, rings = 4) {
    const pt = (p, t) => [cx + Math.cos(p) * Math.cos(t) * rx, cy + Math.sin(p) * ry, cz + Math.cos(p) * Math.sin(t) * rz];
    for (let j = 0; j < rings; j++) {
      const p0 = (j / rings) * Math.PI - Math.PI / 2, p1 = ((j + 1) / rings) * Math.PI - Math.PI / 2;
      for (let i = 0; i < seg; i++) {
        const t0 = (i / seg) * Math.PI * 2, t1 = ((i + 1) / seg) * Math.PI * 2;
        const a = pt(p0, t0), b = pt(p0, t1), c = pt(p1, t1), d = pt(p1, t0);
        if (j === 0) this.tri(a[0], a[1], a[2], d[0], d[1], d[2], c[0], c[1], c[2], hex);
        else if (j === rings - 1) this.tri(a[0], a[1], a[2], d[0], d[1], d[2], b[0], b[1], b[2], hex);
        else this.q(a[0], a[1], a[2], d[0], d[1], d[2], c[0], c[1], c[2], b[0], b[1], b[2], hex);
      }
    }
  }

  tri(ax, ay, az, bx, by, bz, cx, cy, cz, hex) {
    if (this.v + 3 > this.max) { this.overflowed = true; return; }
    const ex = bx - ax, ey = by - ay, ez = bz - az, fx = cx - ax, fy = cy - ay, fz = cz - az;
    let nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const c = col(hex), v = this.v;
    const P = [ax, ay, az, bx, by, bz, cx, cy, cz];
    for (let k = 0; k < 3; k++) {
      const o = v + k;
      this.pos[o * 3] = P[k * 3]; this.pos[o * 3 + 1] = P[k * 3 + 1]; this.pos[o * 3 + 2] = P[k * 3 + 2];
      this.nor[o * 3] = nx; this.nor[o * 3 + 1] = ny; this.nor[o * 3 + 2] = nz;
      this.clr[o * 3] = c.r; this.clr[o * 3 + 1] = c.g; this.clr[o * 3 + 2] = c.b;
      this.uv[o * 2] = 0; this.uv[o * 2 + 1] = 0;
    }
    this.idx[this.i] = v; this.idx[this.i + 1] = v + 1; this.idx[this.i + 2] = v + 2;
    this.v += 3; this.i += 3;
  }

  /** Textured quad using a sign-atlas cell, facing +Z (towards a player driving down -Z). */
  signZ(cx, cy, z, w, h, cell, tint = 0xffffff) {
    const [u0, v0, u1, v1] = resolveCell(cell);
    this.q(cx - w / 2, cy - h / 2, z, cx + w / 2, cy - h / 2, z, cx + w / 2, cy + h / 2, z, cx - w / 2, cy + h / 2, z, tint, u0, v0, u1, v1);
  }

  /** Textured quad on a wall whose outward normal is +X or -X (dir = +1 / -1). */
  signX(x, cy, cz, w, h, cell, dir, tint = 0xffffff) {
    const [u0, v0, u1, v1] = resolveCell(cell);
    if (dir > 0) this.q(x, cy - h / 2, cz + w / 2, x, cy - h / 2, cz - w / 2, x, cy + h / 2, cz - w / 2, x, cy + h / 2, cz + w / 2, tint, u0, v0, u1, v1);
    else this.q(x, cy - h / 2, cz - w / 2, x, cy - h / 2, cz + w / 2, x, cy + h / 2, cz + w / 2, x, cy + h / 2, cz - w / 2, tint, u0, v0, u1, v1);
  }

  /** Build an immutable BufferGeometry from what has been written so far. */
  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(0, this.v * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.slice(0, this.v * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.clr.slice(0, this.v * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.slice(0, this.v * 2), 2));
    g.setIndex(new THREE.BufferAttribute(this.idx.slice(0, this.i), 1));
    g.computeBoundingSphere();
    return g;
  }

  /** Create a reusable dynamic geometry that shares this builder's arrays (for chunk streaming). */
  makeDynamicGeometry() {
    const g = new THREE.BufferGeometry();
    const mk = (arr, n) => { const a = new THREE.BufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    g.setAttribute('position', mk(this.pos, 3));
    g.setAttribute('normal', mk(this.nor, 3));
    g.setAttribute('color', mk(this.clr, 3));
    g.setAttribute('uv', mk(this.uv, 2));
    const ia = new THREE.BufferAttribute(this.idx, 1);
    ia.setUsage(THREE.DynamicDrawUsage);
    g.setIndex(ia);
    g.setDrawRange(0, 0);
    return g;
  }

  /** Push the builder contents to a dynamic geometry made by makeDynamicGeometry() (uploads only the used range). */
  commit(geometry) {
    const a = geometry.attributes;
    const mark = (attr, count) => { attr.clearUpdateRanges(); attr.addUpdateRange(0, count); attr.needsUpdate = true; };
    mark(a.position, this.v * 3); mark(a.normal, this.v * 3); mark(a.color, this.v * 3); mark(a.uv, this.v * 2);
    mark(geometry.index, this.i);
    geometry.setDrawRange(0, this.i);
    if (!geometry.boundingSphere) geometry.boundingSphere = new THREE.Sphere();
  }
}
