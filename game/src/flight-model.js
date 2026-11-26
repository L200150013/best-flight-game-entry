// flight-model.js — the arcade flight model: lift, drag, stall, flap and
// gear drag, ground effect, takeoff, touchdown quality and crash checks.
// Pure state in, state out: no scene, no DOM, no three.js scene graph here
// (only THREE.Vector3 for positions, which main.js owns).

import * as THREE from 'three';
import { AIRCRAFT, LIMITS } from './config.js';

export function createFlightState(spawn) {
  return {
    pos: new THREE.Vector3(spawn.x, spawn.y, spawn.z),
    heading: spawn.heading, // radians, 0 = +X east, grows toward +Z south
    pitch: 0,
    roll: 0,
    speed: spawn.speed || 0,
    vspeed: 0,
    throttle: spawn.throttle ?? 0,
    flaps: 0, // 0 up, 1 take-off, 2 landing
    gearDown: true,
    brakes: false,
    onGround: spawn.onGround ?? true,
    airborne: false,
    fuel: 100,
    damage: 0,
    engineOut: false,
    stalled: false,
    overspeed: false,
    lastTouchdownVs: 0,
    distanceFlown: 0,
  };
}

// Forward unit vector from heading + pitch.
export function forwardVector(state) {
  const cp = Math.cos(state.pitch);
  return new THREE.Vector3(
    Math.cos(state.heading) * cp,
    Math.sin(state.pitch),
    Math.sin(state.heading) * cp
  );
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function approach(v, target, rate, dt) {
  const d = target - v;
  const step = rate * dt;
  if (Math.abs(d) <= step) return target;
  return v + Math.sign(d) * step;
}

/**
 * One physics step. `input` is the shared control state (keyboard, mouse or
 * autopilot all write the same fields): throttleUp/throttleDown, pitch
 * (-1..1, + = nose up), roll (-1..1, + = bank right), rudder (-1..1).
 * `env` carries { heightAt, overRunway, wind, onTouchdown(kind, vspeed) }.
 * Returns an event string ('takeoff' | 'touchdown-soft' | 'touchdown-hard'
 * | 'crash' | 'fuel-empty' | null) for the game layer to react to.
 */
export function stepFlight(state, input, dt, env) {
  const P = AIRCRAFT;
  let event = null;

  // --- throttle ---
  if (input.throttleUp) state.throttle = clamp(state.throttle + dt * 0.55, 0, 1);
  if (input.throttleDown) state.throttle = clamp(state.throttle - dt * 0.55, 0, 1);
  if (state.engineOut) state.throttle = 0;

  // --- attitude: the pilot asks, the airframe answers at a fixed rate ---
  const pitchTarget = clamp(input.pitch, -1, 1) * P.maxPitch;
  const rollTarget = clamp(input.roll, -1, 1) * P.maxRoll;
  state.pitch = approach(state.pitch, pitchTarget, P.pitchRate, dt);
  state.roll = approach(state.roll, rollTarget, P.rollRate, dt);

  // --- turning: banked lift turns the nose; rudder adds a little yaw ---
  const speedForTurn = Math.max(state.speed, 14);
  const turnRate = (9.81 * Math.tan(state.roll)) / speedForTurn;
  state.heading += (turnRate + clamp(input.rudder, -1, 1) * P.yawRate * 0.4) * dt;

  // --- speed: thrust fights drag; flaps, gear and hard banks cost speed ---
  const stallSpeed = state.flaps === 2 ? P.stallFlaps : state.flaps === 1 ? P.stallFlaps + 2 : P.stallClean;
  const dragFactor =
    1 + state.flaps * P.dragFlap + (state.gearDown ? P.dragGear : 0) + Math.abs(state.roll) * P.dragRoll;
  let accel = state.throttle * P.thrustAccel - P.dragBase * dragFactor * state.speed * state.speed;
  if (state.onGround) {
    accel -= 0.35; // rolling resistance
    if (state.brakes) accel -= P.brakeDecel;
    if (state.speed < 0.5 && state.throttle < 0.08) accel = 0;
  } else {
    accel -= Math.sin(state.pitch) * 6.5; // climbing costs speed, diving gains it
  }
  state.speed = clamp(state.speed + accel * dt, 0, 120);
  state.overspeed = state.speed > P.vne;

  // --- lift and sink ---
  const lift = clamp(state.speed / stallSpeed, 0, 1.25);
  state.stalled = !state.onGround && state.speed < stallSpeed;
  if (state.onGround) {
    state.vspeed = 0;
    if (state.speed > P.rotateSpeed && state.pitch > 0.06) {
      state.onGround = false;
      state.airborne = true;
      state.vspeed = state.speed * Math.sin(state.pitch);
      event = 'takeoff';
    }
  } else {
    let vs = state.speed * Math.sin(state.pitch) * lift;
    if (state.stalled) vs -= (1 - lift) * 9 + 2.5; // the nose drops, the sink bites
    // Ground effect: a cushion in the last 6 m that forgives a late flare.
    const gy = env.heightAt(state.pos.x, state.pos.z);
    const agl = state.pos.y - gy;
    if (agl < 6 && vs < 0) vs *= 0.55;
    state.vspeed = vs;
  }

  // --- move ---
  const fwd = forwardVector(state);
  const prevX = state.pos.x;
  const prevZ = state.pos.z;
  state.pos.x += fwd.x * state.speed * dt + env.wind.x * dt;
  state.pos.z += fwd.z * state.speed * dt + env.wind.z * dt;
  state.pos.y += state.vspeed * dt;
  state.pos.y = Math.min(state.pos.y, 600);
  state.distanceFlown += Math.hypot(state.pos.x - prevX, state.pos.z - prevZ);

  // --- ground contact ---
  const groundY = env.heightAt(state.pos.x, state.pos.z);
  const gearY = groundY + 1.15;
  if (state.pos.y <= gearY) {
    state.pos.y = gearY;
    const vs = state.vspeed;
    state.lastTouchdownVs = vs;
    if (!state.onGround) {
      const runway = env.overRunway ? env.overRunway(state.pos.x, state.pos.z) : false;
      if (vs < -LIMITS.crashTouchdown || (!runway && state.speed > 42 && vs < -5)) {
        state.damage = 100;
        event = 'crash';
      } else if (vs < -LIMITS.hardTouchdown || Math.abs(state.roll) > 0.45) {
        state.damage = Math.min(100, state.damage + LIMITS.damageHardLanding);
        state.onGround = true;
        state.vspeed = 0;
        event = 'touchdown-hard';
      } else {
        state.onGround = true;
        state.vspeed = 0;
        event = 'touchdown-soft';
      }
      if (state.onGround) state.pitch = Math.min(state.pitch, 0.08);
    }
  }

  // --- overspeed damage accrues while past the red line ---
  if (state.overspeed && !state.onGround) {
    state.damage = Math.min(100, state.damage + LIMITS.damageOverspeed * dt);
  }
  if (state.damage >= 100 && event !== 'crash') event = 'crash';
  return event;
}

/** Fuel burn for one step; returns 'fuel-empty' the moment the tank runs dry. */
export function stepFuel(state, dt) {
  if (state.fuel <= 0) return null;
  const burn = AIRCRAFT.fuelBurnIdle + state.throttle * AIRCRAFT.fuelBurnThrottle;
  state.fuel = Math.max(0, state.fuel - burn * dt);
  if (state.fuel <= 0 && !state.engineOut) {
    state.engineOut = true;
    return 'fuel-empty';
  }
  return null;
}

export function resetFlightState(state, spawn) {
  const fresh = createFlightState(spawn);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
}
