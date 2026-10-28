// ============================================================================
// Central game configuration. Tweak balance here, not in the game code.
// Units: metres, seconds, kilograms. Speeds are m/s (km/h = m/s * 3.6).
// ============================================================================

export const WORLD = {
  chunkLength: 84,           // multiple of 3 so window tiles line up with building edges
  zoneChunks: 9,            // chunks per Dhaka area (756 m each)
  chunksAhead: 5,
  chunksBehind: 1,
  roadHalfWidth: 14.4,      // edge of asphalt
  wallHalfWidth: 15.4,      // invisible wall player cannot cross
  laneWidth: 3.4,
  medianHalf: 0.8,
  laneCount: 4,             // lanes per carriageway
  // Left-side driving: the player's carriageway is x < 0 (travel direction is -Z)
};

export const SCORING = {
  distancePerMeter: 0.15,
  nearMiss: { maxGap: 1.3, minPlayerSpeed: 12, minRelSpeed: 3.5, base: 100, oncomingBonus: 70 },
  tightGap: { bonus: 220, window: 1.4 },
  ram: { minImpulse: 1500, cooldown: 0.45 },       // points per vehicle come from vehicles.js (`ram`)
  pickup: { points: 260, passengersMin: 2, passengersMax: 5, dwellSeconds: 1.0, maxSpeed: 7.5, repair: 6 },
  policeEscape: 1500,
  surviveBonus: { every: 30, points: 250 },
  routeComplete: { points: 3000, passengerTarget: 5, passengerBonus: 1500 },
  combo: { timeout: 4.5, stepEvery: 3, stepSize: 0.5, maxMultiplier: 5 },
  penalty: {
    threshold: 9000,          // impulse below this is free (light shoves)
    perThousandImpulse: 3.2,  // score lost per 1000 impulse over the threshold
    comboBreakImpulse: 20000, // hits harder than this reset the combo
    wall: 40,
  },
};

export const DAMAGE = {
  // Integrity (0-100). A hit costs (impulse - threshold) / divisor percent.
  threshold: 9000,
  divisor: 7000,
  wall: 2.0,
  cooldown: 0.25,
};

export const BOOST = {
  maxEnergy: 100,
  drain: 30,                 // energy per second while boosting
  regenDelay: 1.2,
  regen: 14,
  minToStart: 22,            // cannot start unless energy >= this (acts as cooldown)
  steerPenalty: 0.72,        // steering multiplier while boosting
  fovAdd: 12,
};

export const POLICE = {
  heatThreshold: 100,
  heatDecay: 3.0,            // per second when no pursuit
  heatPerImpulse: 1 / 1400,  // heat added per impulse unit when hitting traffic
  heatMaxPerHit: 22,
  wrongWayHeatPerSec: 9,
  spawnBehind: [62, 84],
  baseSpeed: 24,
  speedPerLevel: 2.6,
  maxLevel: 3,
  levelEvery: 22,            // seconds in pursuit per level
  accel: 8.5,
  bustRadius: 10.5,
  bustRate: 16,              // % per second when a unit is within bustRadius
  bustDecay: 22,
  escapeDistance: 95,
  escapeSeconds: 6,
  cooldownAfterEscape: 28,
  initialGrace: 18,          // seconds at the start of a run with no police
};

export const TRAFFIC = {
  maxVehicles: 30,
  maxVehiclesLow: 20,
  spawnAheadMin: 190,
  spawnAheadMax: 290,
  despawnBehind: 70,
  despawnAhead: 380,
  minGap: 5.0,
  headway: 1.0,              // seconds of following distance
  oncomingShare: 0.42,
  jamEvery: [38, 70],        // seconds between traffic jams
  jamDuration: 24,
  jamLength: 110,
  jamSpeed: 1.5,
};

export const CAMERA = {
  distance: 13,
  height: 4.9,
  lookAhead: 14,
  fov: 68,
  shakeDecay: 6,
};

export const CONTROLS = {
  // Keyboard map: action -> list of KeyboardEvent.code values. Edit freely.
  keys: {
    accel: ['KeyW', 'ArrowUp'],
    brake: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    boost: ['ShiftLeft', 'ShiftRight'],
    horn: ['Space', 'KeyH'],
    pause: ['Escape', 'KeyP'],
    restart: ['KeyR'],
  },
  steerRiseRate: 5.5,   // how fast steering input ramps to full lock
  steerFallRate: 8,
};

// Player buses. Add more entries to add more buses; the menu picks them up automatically.
export const PLAYER_BUSES = [
  {
    id: 'jhor', name: 'ঝড় এক্সপ্রেস', en: 'Jhor Express',
    color: 0xd62828, accent: 0xffc300, trim: 0x1d3557, roof: 0xf1f1f1,
    maxSpeed: 28, boostSpeed: 40, accel: 6.2, boostAccel: 12, brake: 22, steer: 1.05, grip: 5.2,
    mass: 9500, banner: 'ঝড় এক্সপ্রেস', sub: 'মিরপুর – বাড্ডা – আগারগাঁও',
  },
  {
    id: 'sobuj', name: 'সবুজ ছায়া', en: 'Shobuj Chhaya',
    color: 0x2a9d4f, accent: 0xfff1a8, trim: 0x0b3d2e, roof: 0xe6efe0,
    maxSpeed: 26, boostSpeed: 38, accel: 5.6, boostAccel: 11, brake: 21, steer: 1.22, grip: 5.8,
    mass: 8200, banner: 'সবুজ ছায়া', sub: 'রামপুরা – মিরপুর ১০',
  },
  {
    id: 'akash', name: 'নীল আকাশ', en: 'Neel Akash',
    color: 0x1d6fd1, accent: 0xff7f11, trim: 0x10243e, roof: 0xdde7f5,
    maxSpeed: 30, boostSpeed: 42, accel: 6.8, boostAccel: 13, brake: 24, steer: 0.95, grip: 4.8,
    mass: 11000, banner: 'নীল আকাশ', sub: 'আগারগাঁও – রামপুরা',
  },
];

export const DEFAULT_SETTINGS = {
  master: 0.9, engine: 0.7, traffic: 0.6, voice: 0.9, effects: 0.8,
  quality: 'auto',   // auto | low | high
  shake: true,
  subtitles: true,
  busId: 'jhor',
  tutorialSeen: false,
};

export const STORAGE_KEYS = { best: 'dhakaLocalRush.best.v1', settings: 'dhakaLocalRush.settings.v1' };
