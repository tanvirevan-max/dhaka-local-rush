// Vehicle model registry: shared (cached) geometries, one per type + variant.
import { buildBusGeometry } from './bus.js';
import { buildCNG, buildRickshaw, buildMotorcycle, buildBicycle } from './small.js';
import { buildCar, buildTruck, buildPolice } from './cars.js';

export { buildBusGeometry, buildBusWheel } from './bus.js';
export { POLICE_LIGHT } from './cars.js';

const cache = new Map();

const BUS_PALETTES = [
  { color: 0xe4572e, accent: 0xf3d34a, trim: 0x1b3a4b, roof: 0xe9e9e9 },
  { color: 0x2f80c9, accent: 0xffffff, trim: 0x0f2a4a, roof: 0xe5ecf2 },
  { color: 0x38a169, accent: 0xffe08a, trim: 0x123524, roof: 0xe7f0e2 },
  { color: 0xd1495b, accent: 0xffd166, trim: 0x3d1c26, roof: 0xf0e6e6 },
  { color: 0xf2a541, accent: 0x7a1f1f, trim: 0x3a2a12, roof: 0xf4efe3 },
  { color: 0x7b4fb8, accent: 0xffd23f, trim: 0x261542, roof: 0xece6f5 },
];

export const VARIANT_COUNT = { bus: 6, truck: 4, car: 18, cng: 3, rickshaw: 6, motorcycle: 5, bicycle: 3, police: 1 };

/** Shared geometry for a traffic vehicle type. Variant index wraps. */
export function getVehicleGeometry(type, variant = 0) {
  const n = VARIANT_COUNT[type] || 1;
  const v = ((variant % n) + n) % n;
  const key = `${type}:${v}`;
  let g = cache.get(key);
  if (g) return g;
  switch (type) {
    case 'bus': g = buildBusGeometry(2.5, 9.6, BUS_PALETTES[v], { seed: 31 + v, bakeWheels: true }).geometry; break;
    case 'truck': g = buildTruck(v); break;
    case 'car': g = buildCar(v); break;
    case 'cng': g = buildCNG(v); break;
    case 'rickshaw': g = buildRickshaw(v); break;
    case 'motorcycle': g = buildMotorcycle(v); break;
    case 'bicycle': g = buildBicycle(v); break;
    case 'police': g = buildPolice(); break;
    default: throw new Error('Unknown vehicle type ' + type);
  }
  cache.set(key, g);
  return g;
}

export function disposeVehicleGeometries() {
  for (const g of cache.values()) g.dispose();
  cache.clear();
}
