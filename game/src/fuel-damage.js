// fuel-damage.js — fuel burn and the damage model: hard landings bend
// the gear (more drag, worse handling), overspeed hurts the control
// surfaces, and a terrain strike ends the sortie. Smoke and warnings are
// the visible price, so a sortie is always a decision, never a free ride.

import { stepFuel } from './flight-model.js';

// Burn fuel for one step. Returns 'fuel-empty' once, the moment the tank
// runs dry and the engine quits.
export function burnFuel(state, dt) {
  return stepFuel(state, dt);
}

// Handling penalty from damage: 0 (pristine) to 1 (barely flying).
export function handlingPenalty(state) {
  return Math.min(1, state.damage / 100);
}

// Extra drag from a bent gear: the plane slows and wallows.
export function bentGearDrag(state) {
  return state.damage > 40 ? 0.35 : 0;
}

export function damageLabel(state) {
  if (state.damage >= 100) return 'DESTROYED';
  if (state.damage > 70) return 'CRITICAL';
  if (state.damage > 40) return 'DAMAGED';
  if (state.damage > 0) return 'SCRATCHED';
  return 'OK';
}

// Should the engine smoke right now? Damage over 40, or an engine-out glide.
export function shouldSmoke(state) {
  return state.damage > 40 || state.engineOut;
}

// A short human sentence for a flight event, shown in the HUD message line.
export function eventMessage(event, state) {
  switch (event) {
    case 'takeoff': return 'AIRBORNE — gear up when clear (G)';
    case 'touchdown-soft': return 'TOUCHDOWN — nice and soft.';
    case 'touchdown-hard': return 'HARD LANDING — gear bent, drag up!';
    case 'crash': return 'CRASHED — the K-7 is done for.';
    case 'fuel-empty': return 'FUEL EMPTY — glide to the nearest strip!';
    default: return '';
  }
}
