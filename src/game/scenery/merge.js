// Copy an existing BufferGeometry (e.g. a rickshaw model) into a GeoBuilder with a Y rotation + translation.
// Lets road chunks reuse the vehicle models for parked vehicles without extra modelling work.
export function appendGeometry(builder, geo, x, y, z, yaw = 0, scale = 1) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, clr = geo.attributes.color, uv = geo.attributes.uv;
  const idx = geo.index;
  const vc = pos.count;
  if (builder.v + vc > builder.max || builder.i + idx.count > builder.idx.length) { builder.overflowed = true; return; }
  const s = Math.sin(yaw), c = Math.cos(yaw);
  const base = builder.v;
  for (let i = 0; i < vc; i++) {
    const px = pos.getX(i) * scale, py = pos.getY(i) * scale, pz = pos.getZ(i) * scale;
    const o = base + i;
    builder.pos[o * 3] = x + px * c + pz * s;
    builder.pos[o * 3 + 1] = y + py;
    builder.pos[o * 3 + 2] = z - px * s + pz * c;
    const nx = nor.getX(i), nz = nor.getZ(i);
    builder.nor[o * 3] = nx * c + nz * s;
    builder.nor[o * 3 + 1] = nor.getY(i);
    builder.nor[o * 3 + 2] = -nx * s + nz * c;
    builder.clr[o * 3] = clr.getX(i); builder.clr[o * 3 + 1] = clr.getY(i); builder.clr[o * 3 + 2] = clr.getZ(i);
    builder.uv[o * 2] = uv.getX(i); builder.uv[o * 2 + 1] = uv.getY(i);
  }
  for (let i = 0; i < idx.count; i++) builder.idx[builder.i + i] = base + idx.getX(i);
  builder.v += vc;
  builder.i += idx.count;
}
