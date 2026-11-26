// config.js — every tunable number of POS LANGIT in one place:
// the aircraft, the islands, the airstrips, the missions and the palette.
// Nothing here reads the network or the DOM; main.js imports it first.

export const AIRCRAFT = {
  name: 'Merpati K-7',
  // Speeds in m/s. Stall drops with flaps; Vne is the red line.
  stallClean: 27,
  stallFlaps: 22,
  rotateSpeed: 30,
  maxSpeed: 82,
  vne: 78,
  // Thrust / drag tuning: full throttle levels near 62 m/s, dives reach Vne.
  thrustAccel: 9.5,
  dragBase: 0.0016,
  dragFlap: 0.45,
  dragGear: 0.28,
  dragRoll: 0.25,
  brakeDecel: 6.0,
  // Control authority (radians per second at full deflection).
  pitchRate: 1.15,
  rollRate: 2.1,
  yawRate: 0.35,
  maxPitch: 0.5,
  maxRoll: 1.05,
  // Fuel: percent per second at idle + per throttle.
  fuelBurnIdle: 0.1,
  fuelBurnThrottle: 0.42,
  fuelCapacity: 100,
};

export const WORLD = {
  seaLevel: 0,
  // The map spans about 5.6 km; the playable area is the island chain.
  size: 5600,
  segments: 150,
  // One island = a smooth bump plus noise. Peak heights in metres.
  islands: [
    { x: 0, z: 0, r: 1650, peak: 90 },
    { x: -380, z: -480, r: 620, peak: 265 }, // the volcano cone
    { x: 1980, z: -680, r: 980, peak: 150 },
    { x: -1780, z: 960, r: 880, peak: 130 },
    { x: 720, z: 1620, r: 480, peak: 62 },
    { x: -1020, z: -1520, r: 430, peak: 58 },
    { x: 2450, z: 950, r: 360, peak: 48 },
  ],
  // Airstrips: flat ground, a runway mesh and a windsock each.
  strips: [
    {
      id: 'merpati',
      name: 'Merpati Field',
      x: 560, z: 360,
      headingDeg: 90, // runway runs east-west
      elev: 9,
      runwayLength: 300,
      runwayWidth: 20,
    },
    {
      id: 'timur',
      name: 'Pulau Timur',
      x: 1980, z: -680,
      headingDeg: 40,
      elev: 11,
      runwayLength: 280,
      runwayWidth: 18,
    },
    {
      id: 'barat',
      name: 'Pulau Barat',
      x: -1780, z: 960,
      headingDeg: 130,
      elev: 12,
      runwayLength: 260,
      runwayWidth: 18,
    },
  ],
  // Ring Rally route: eight rings island-hopping at 60-150 m, each leg
  // flowing into the next so the following ring is visible ahead.
  rings: [
    { x: 950, y: 95, z: 150 },
    { x: 1400, y: 115, z: -250 },
    { x: 1850, y: 105, z: -620 },
    { x: 2300, y: 120, z: -1000 },
    { x: 1700, y: 140, z: -1400 },
    { x: 800, y: 145, z: -1200 },
    { x: 300, y: 135, z: -1050 },
    { x: -900, y: 110, z: 200 },
  ],
  ringRadius: 16,
  // Storm Landing: steady crosswind from the south-west, m/s.
  stormWind: { x: -6.5, z: 9.5 },
  calmWind: { x: 1.5, z: -1.0 },
};

export const MISSIONS = {
  mail: {
    id: 'mail',
    title: 'MAIL RUN',
    tagline: 'Antar paket pos ke tiga airstrip — hemat fuel, kejar waktu.',
    legs: ['timur', 'barat', 'merpati'],
    startStrip: 'merpati',
    fuelStart: 100,
  },
  rings: {
    id: 'rings',
    title: 'RING RALLY',
    tagline: 'Terbang melewati 8 ring berurutan — presisi lawan momentum.',
    fuelStart: 100,
  },
  storm: {
    id: 'storm',
    title: 'STORM LANDING',
    tagline: 'Mendarat di strip pendek dengan crosswind dan fuel 25%.',
    targetStrip: 'barat',
    fuelStart: 25,
  },
};

export const PALETTE = {
  skyTop: 0x2f6fb4,
  skyHorizon: 0xbfe3ef,
  sea: 0x1d8a8a,
  seaDeep: 0x146666,
  sand: 0xd9c28a,
  grass: 0x6f9e4a,
  grassDark: 0x557f38,
  forest: 0x3f7031,
  rock: 0x8a7f74,
  volcano: 0x5b4a44,
  runway: 0x3a3f45,
  runwayLine: 0xf2f2e8,
  aircraftCream: 0xf2e6c9,
  aircraftRed: 0xc0392b,
  aircraftDark: 0x2c3e50,
  ringNext: 0xff8c1a,
  ringDone: 0x2ecc71,
};

export const LIMITS = {
  maxAltitude: 600,
  // Landing quality: vertical speed at touchdown, m/s.
  softTouchdown: 2.6,
  hardTouchdown: 4.5,
  crashTouchdown: 7.0,
  // Damage model thresholds.
  damageHardLanding: 22,
  damageOverspeed: 12,
  damageStallScrape: 40,
};
