// Traffic / police vehicle definitions. Dimensions are metres (w = width, l = length).
// lanes: allowed lane indices (0 = next to the median, 3 = kerb-side outer lane).
// ram: points for shoving this vehicle aside. nm: near-miss multiplier.
export const VEHICLE_TYPES = {
  bus:        { w: 2.5,  l: 9.6, mass: 8500,  speed: [8, 13],  lanes: [1, 2, 3], weight: 2.0, ram: 0,  nm: 1.5, heavy: true,  fragile: false, horn: 'bus' },
  truck:      { w: 2.5,  l: 8.2, mass: 11000, speed: [7, 12],  lanes: [1, 2],    weight: 1.3, ram: 0,  nm: 1.5, heavy: true,  fragile: false, horn: 'truck' },
  car:        { w: 1.9,  l: 4.4, mass: 1300,  speed: [9, 16],  lanes: [0, 1, 2, 3], weight: 3.2, ram: 12, nm: 1.0, heavy: false, fragile: false, horn: 'car' },
  cng:        { w: 1.45, l: 2.8, mass: 550,   speed: [6, 12],  lanes: [1, 2, 3], weight: 3.4, ram: 20, nm: 1.0, heavy: false, fragile: true,  horn: 'cng' },
  rickshaw:   { w: 1.15, l: 2.6, mass: 260,   speed: [3, 5.5], lanes: [3],       weight: 4.2, ram: 25, nm: 1.2, heavy: false, fragile: true,  horn: 'bell' },
  motorcycle: { w: 0.8,  l: 2.0, mass: 220,   speed: [9, 17],  lanes: [0, 1, 2, 3], weight: 2.6, ram: 28, nm: 1.3, heavy: false, fragile: true,  horn: 'moto' },
  bicycle:    { w: 0.65, l: 1.8, mass: 110,   speed: [3, 5],    lanes: [3],       weight: 1.2, ram: 30, nm: 1.3, heavy: false, fragile: true,  horn: 'bell' },
  police:     { w: 2.0,  l: 5.0, mass: 1900,  speed: [20, 30], lanes: [0, 1, 2, 3], weight: 0,   ram: 0,  nm: 0,   heavy: false, fragile: false, horn: 'car' },
};

// Per-zone traffic mix multipliers are in zones.js

// Arcade handling per type (traffic + police). accel/brake in m/s^2.
// steer = max yaw rate (rad/s) at low speed, steerRef = speed (m/s) above which steering gets sluggish,
// grip = lateral velocity decay per second, stunGrip = same while the vehicle is out of control after a hit,
// spinDamp = decay of collision spin, drag = rolling drag, tip = impulse/mass (m/s) needed to knock it over (0 = never).
export const HANDLING = {
  bus:        { accel: 2.6, brake: 8,  steer: 0.75, steerRef: 14, grip: 3.2, stunGrip: 0.8, spinDamp: 2.4, drag: 0.012, tip: 0 },
  truck:      { accel: 2.2, brake: 7,  steer: 0.7,  steerRef: 14, grip: 3.2, stunGrip: 0.7, spinDamp: 2.4, drag: 0.012, tip: 0 },
  car:        { accel: 4.5, brake: 10, steer: 1.5,  steerRef: 18, grip: 5.0, stunGrip: 1.1, spinDamp: 2.8, drag: 0.01,  tip: 0 },
  cng:        { accel: 3.5, brake: 8,  steer: 1.7,  steerRef: 16, grip: 5.0, stunGrip: 1.0, spinDamp: 2.6, drag: 0.015, tip: 6.0 },
  rickshaw:   { accel: 1.4, brake: 5,  steer: 1.5,  steerRef: 12, grip: 5.5, stunGrip: 1.0, spinDamp: 3.0, drag: 0.02,  tip: 3.2 },
  motorcycle: { accel: 5.0, brake: 9,  steer: 1.9,  steerRef: 20, grip: 6.0, stunGrip: 1.1, spinDamp: 3.0, drag: 0.012, tip: 2.6 },
  bicycle:    { accel: 1.2, brake: 5,  steer: 1.6,  steerRef: 12, grip: 6.0, stunGrip: 1.1, spinDamp: 3.0, drag: 0.02,  tip: 2.2 },
  police:     { accel: 8.5, brake: 14, steer: 1.6,  steerRef: 24, grip: 5.2, stunGrip: 1.2, spinDamp: 2.8, drag: 0.008, tip: 0 },
};
