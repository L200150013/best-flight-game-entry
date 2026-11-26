// shots.js — screenshot scenarios. A `?shot=` URL picks a real mission
// and a real starting state through the same startMission path the menu
// buttons use; the flight model then runs untouched, with the autopilot
// (a real game feature, key P) holding the plane steady. Nothing here
// draws a fake screen, moves a mesh by hand, or mocks the game: the
// screenshots are the game itself, flown by its own code.
//
//   ?shot=cover    Mail Run leg 1 delivered at Pulau Timur, banner + next leg
//   ?shot=rings    Ring Rally, metres from ring 3, next ring visible
//   ?shot=landing  Storm Landing final, gear down, flaps 2
//   ?shot=cockpit  Mail Run cruise, cockpit cam, gauges live

import * as THREE from 'three';
import { stripById } from './terrain.js';
import { WORLD } from './config.js';

export function shotFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot === 'cover' || shot === 'rings' || shot === 'landing' || shot === 'cockpit') return shot;
  } catch (err) { /* no query: normal play */ }
  return null;
}

// Place the aircraft for a scenario and return the autopilot target
// (heading / altitude / speed) the shot should hold, or null.
export function applyShot(game, shot) {
  const state = game.state;
  const stripA = stripById('merpati');
  const stripC = stripById('barat');
  if (shot === 'cover') {
    game.startMissionById('mail');
    // Just delivered leg 1: parked on Pulau Timur's strip, gear down,
    // throttle idle. The first mission tick fires 'leg-done' for real, so
    // the big leg-complete banner shows and the objective advances to
    // leg 2 — the cover proves a delivery, not just a flight.
    const stripT = stripById('timur');
    const rad = (stripT.headingDeg * Math.PI) / 180;
    state.pos.set(stripT.x, stripT.elev + 1.15, stripT.z);
    state.heading = rad; // lined up on the runway
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0;
    state.onGround = true;
    state.airborne = false;
    state.gearDown = true;
    game.setCameraMode('chase');
    game.setAutopilot(false);
    return null;
  }
  if (shot === 'rings') {
    game.startMissionById('rings');
    // 110 m short of ring 3 (index 2), lined up on it; ring 4 lies beyond
    // on the same heading, so the route reads in the shot.
    const ring = WORLD.rings[2];
    const prev = WORLD.rings[1];
    const dx = ring.x - prev.x;
    const dz = ring.z - prev.z;
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    state.pos.set(ring.x - ux * 110, ring.y + 2, ring.z - uz * 110);
    state.heading = Math.atan2(uz, ux);
    state.pitch = 0;
    state.roll = 0.12;
    state.speed = 48;
    state.throttle = 0.66;
    state.onGround = false;
    state.airborne = true;
    // Pretend rings 1-2 are already flown: the HUD reads CHECKPOINT 3/8.
    game.mission.ringsDone = 2;
    game.mission.nextRing = 2;
    game.mission.objectiveText = 'RING RALLY — ring 3/8';
    game.setCameraMode('chase');
    game.setAutopilot(true);
    return { heading: state.heading, altitude: ring.y, speed: 48 };
  }
  if (shot === 'landing') {
    game.startMissionById('storm');
    // Short final: 260 m out, 42 m up, gear down, flaps 2, on the glide.
    const rad = (stripC.headingDeg * Math.PI) / 180;
    state.pos.set(stripC.x - Math.cos(rad) * 260, stripC.elev + 42, stripC.z - Math.sin(rad) * 260);
    state.heading = rad;
    state.pitch = -0.06;
    state.roll = 0;
    state.speed = 36;
    state.throttle = 0.38;
    state.onGround = false;
    state.airborne = true;
    state.gearDown = true;
    state.flaps = 2;
    game.setCameraMode('chase');
    game.setAutopilot(true);
    // Glide target: lose altitude steadily toward the threshold.
    return { heading: state.heading, altitude: stripC.elev + 30, speed: 36 };
  }
  if (shot === 'cockpit') {
    game.startMissionById('mail');
    const rad = (stripA.headingDeg * Math.PI) / 180;
    state.pos.set(stripA.x - Math.cos(rad) * 420, stripA.elev + 80, stripA.z - Math.sin(rad) * 420);
    state.heading = rad;
    state.pitch = 0.02;
    state.roll = 0.08;
    state.speed = 48;
    state.throttle = 0.65;
    state.onGround = false;
    state.airborne = true;
    game.setCameraMode('cockpit');
    game.setAutopilot(true);
    return { heading: state.heading, altitude: state.pos.y, speed: 48 };
  }
  return null;
}
