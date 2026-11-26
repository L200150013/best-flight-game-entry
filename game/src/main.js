// main.js — bootstrap and game loop for POS LANGIT. Wires every module
// together: terrain, sky, aircraft, flight model, missions, HUD, gauges,
// audio, effects and cameras. The loop is the only place time advances.

import * as THREE from 'three';
import { WORLD, MISSIONS } from './config.js';
import { createTerrain, heightAt, stripById, overRunway } from './terrain.js';
import { createSky, updateSky } from './sky.js';
import { buildAircraft, updateAircraft } from './aircraft.js';
import { createFlightState, stepFlight, forwardVector } from './flight-model.js';
import { createCameraRig, updateCamera, setCameraMode } from './camera.js';
import { createInputState, bindInput, autopilotControl } from './input.js';
import { createHud, updateHud, buildCockpitGauges, buildDashboard, updateGauges } from './hud-instruments.js';
import { createMissionState, missionSpawn, startMission, updateMission, buildRings, updateRingsVisual } from './missions.js';
import { burnFuel, shouldSmoke, eventMessage } from './fuel-damage.js';
import { createAudio, startAudio, updateAudio, playCheckpoint, playGearClunk, playTouchdown, playStallWarning, playMissionComplete, playMissionFailed } from './audio.js';
import { createEffects, emitSmoke, emitDustBurst, updateEffects, pulseNextRing } from './effects.js';
import { shotFromUrl, applyShot } from './shots.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe4ee, 900, 5200);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 9000);
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xbfd9e8, 0x8a7a5a, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.25);
sun.position.set(-1500, 1800, -800);
scene.add(sun);

createTerrain(scene);
const sky = createSky(scene);
const aircraft = buildAircraft();
scene.add(aircraft.group);
const rings = buildRings(scene);
const gauges = buildCockpitGauges();
const dashboard = buildDashboard(gauges);
const effects = createEffects(scene);
const audio = createAudio();
const input = createInputState();
const hud = createHud();
const mission = createMissionState();
const cameraRig = createCameraRig(camera);

const game = {
  state: createFlightState(missionSpawn('mail')),
  mission,
  groundY: 9,
  objectiveText: 'Pilih misi untuk terbang.',
  scoreText: '',
  autopilot: false,
  autopilotTarget: null,
  paused: false,
  time: 0,
  frames: 0,
  startMissionById(id) {
    const spawn = missionSpawn(id);
    const fresh = createFlightState(spawn);
    for (const key of Object.keys(fresh)) game.state[key] = fresh[key];
    startMission(mission, id, game.state);
    game.objectiveText = mission.objectiveText;
    game.scoreText = '';
    game.autopilotTarget = null;
    game.setAutopilot(false);
    hideOverlays();
    startAudio(audio);
  },
  setCameraMode(mode) {
    setCameraMode(cameraRig, mode);
    if (mode === 'cockpit') {
      dashboard.position.set(0, -0.42, -1.6);
      camera.add(dashboard);
    } else {
      camera.remove(dashboard);
    }
  },
  setAutopilot(on, target) {
    game.autopilot = on;
    if (on) {
      game.autopilotTarget = target || {
        heading: game.state.heading,
        altitude: game.state.pos.y,
        speed: Math.max(30, game.state.speed),
      };
    } else {
      game.autopilotTarget = null;
    }
    updateAutopilotChip();
  },
};
window.__poslangit = game;

function updateAutopilotChip() {
  const chip = document.getElementById('hud-autopilot');
  if (chip) {
    chip.textContent = game.autopilot ? 'AUTOPILOT ON' : 'AUTOPILOT OFF';
    chip.classList.toggle('on', game.autopilot);
  }
}

function showMenu() {
  document.getElementById('menu').classList.remove('hidden');
  document.getElementById('end').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
}
function hideOverlays() {
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('end').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
}
function showEnd(title, detail, score) {
  const end = document.getElementById('end');
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-detail').textContent = detail;
  document.getElementById('end-score').textContent = score || '';
  end.classList.remove('hidden');
}

function setMessage(text) {
  const m = document.getElementById('hud-msg');
  if (m) {
    m.textContent = text;
    m.classList.remove('hidden');
    clearTimeout(setMessage.timer);
    setMessage.timer = setTimeout(() => m.classList.add('hidden'), 4200);
  }
}

function windFor() {
  return mission.id === 'storm' && mission.status === 'flying'
    ? { x: WORLD.stormWind.x, z: WORLD.stormWind.z }
    : { x: WORLD.calmWind.x, z: WORLD.calmWind.z };
}

function overRunwayAt(x, z) {
  for (const strip of WORLD.strips) {
    if (overRunway(strip, x, z, 6)) return true;
  }
  return false;
}

bindInput(input, {
  canvas,
  onFirstGesture: () => startAudio(audio),
  onLook: (dx, dy) => {
    if (cameraRig.mode !== 'chase') return;
    cameraRig.lookYaw = Math.max(-0.6, Math.min(0.6, cameraRig.lookYaw - dx));
    cameraRig.lookPitch = Math.max(-0.35, Math.min(0.35, cameraRig.lookPitch - dy));
  },
});

document.querySelectorAll('[data-mission]').forEach((btn) => {
  btn.addEventListener('click', () => game.startMissionById(btn.dataset.mission));
});
document.getElementById('btn-menu').addEventListener('click', () => {
  mission.status = 'menu';
  game.objectiveText = 'Pilih misi untuk terbang.';
  showMenu();
});
document.getElementById('btn-again').addEventListener('click', () => {
  if (mission.id) game.startMissionById(mission.id);
});
document.getElementById('btn-end-menu').addEventListener('click', () => {
  mission.status = 'menu';
  showMenu();
});
document.getElementById('btn-resume').addEventListener('click', () => {
  game.paused = false;
  document.getElementById('pause').classList.add('hidden');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- the loop ---
let last = performance.now();
let stallBeepAt = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
  last = now;
  game.time += dt;

  // Edge-triggered actions.
  for (const action of input.pressed) {
    if (action === 'flaps' && mission.status === 'flying') {
      game.state.flaps = (game.state.flaps + 1) % 3;
      setMessage(['FLAPS UP', 'FLAPS 1 — take-off', 'FLAPS 2 — landing'][game.state.flaps]);
    }
    if (action === 'gear' && mission.status === 'flying' && !game.state.onGround) {
      game.state.gearDown = !game.state.gearDown;
      playGearClunk(audio);
      setMessage(game.state.gearDown ? 'GEAR DOWN' : 'GEAR UP');
    }
    if (action === 'camera') {
      game.setCameraMode(cameraRig.mode === 'chase' ? 'cockpit' : 'chase');
    }
    if (action === 'autopilot' && mission.status === 'flying') {
      game.setAutopilot(!game.autopilot);
      setMessage(game.autopilot ? 'AUTOPILOT ON — holds heading, altitude, speed' : 'AUTOPILOT OFF');
    }
    if (action === 'restart' && mission.id) game.startMissionById(mission.id);
    if (action === 'pause') {
      game.paused = !game.paused;
      document.getElementById('pause').classList.toggle('hidden', !game.paused);
    }
    if (action.startsWith('mission-') && mission.status !== 'flying') {
      game.startMissionById(action.slice('mission-'.length));
    }
  }
  input.pressed.clear();

  if (!game.paused) {
    const state = game.state;
    const wind = windFor();
    game.groundY = heightAt(state.pos.x, state.pos.z);

    // Controls: the autopilot writes the same fields the keyboard does.
    let activeInput = input;
    if (game.autopilot && game.autopilotTarget && mission.status === 'flying') {
      const ap = autopilotControl(state, game.autopilotTarget, dt);
      activeInput = {
        throttleUp: ap.throttleUp,
        throttleDown: ap.throttleDown,
        pitch: ap.pitch,
        roll: ap.roll,
        rudder: ap.rudder,
        brakes: false,
        pressed: input.pressed,
      };
      // Landing shots glide: the autopilot target sinks toward the runway.
      if (game.autopilotTarget.glide) {
        const target = stripById(MISSIONS.storm.targetStrip);
        const dist = Math.hypot(state.pos.x - target.x, state.pos.z - target.z);
        game.autopilotTarget.altitude = target.elev + Math.max(6, dist * 0.14);
        game.autopilotTarget.heading = Math.atan2(target.z - state.pos.z, target.x - state.pos.x);
      }
    }
    state.brakes = activeInput.brakes;

    const env = {
      heightAt,
      overRunway: overRunwayAt,
      wind,
    };
    const flightEvent = mission.status === 'flying'
      ? stepFlight(state, activeInput, dt, env)
      : null;
    if (flightEvent) {
      const msg = eventMessage(flightEvent, state);
      if (msg) setMessage(msg);
      if (flightEvent === 'touchdown-soft') {
        playTouchdown(audio, false);
        emitDustBurst(effects, state.pos);
      }
      if (flightEvent === 'touchdown-hard') {
        playTouchdown(audio, true);
        emitDustBurst(effects, state.pos);
      }
      if (flightEvent === 'crash') {
        mission.status = 'lost';
        mission.failReason = 'Pesawat hancur — terrain strike atau touchdown fatal.';
        playMissionFailed(audio);
        showEnd('MISI GAGAL', mission.failReason, `DAMAGE 100% • ${mission.timerText}`);
      }
    }
    const fuelEvent = mission.status === 'flying' ? burnFuel(state, dt) : null;
    if (fuelEvent === 'fuel-empty') setMessage(eventMessage('fuel-empty', state));
    if (state.stalled && game.time - stallBeepAt > 0.9) {
      playStallWarning(audio);
      stallBeepAt = game.time;
    }

    const missionEvent = updateMission(mission, state, rings, dt, env);
    if (missionEvent === 'checkpoint') {
      playCheckpoint(audio);
      setMessage(`CHECKPOINT ${mission.ringsDone}/8 — ring berikutnya di depan!`);
    }
    if (missionEvent === 'leg-done') {
      playCheckpoint(audio);
      setMessage(`PAKET TERANTAR ${mission.legsDone}/3 — lanjut ke ${mission.targetStrip.name}!`);
    }
    if (missionEvent === 'won') {
      playMissionComplete(audio);
      game.scoreText = mission.scoreText;
      showEnd('MISI SELESAI', mission.winText, mission.scoreText);
    }
    if (missionEvent === 'lost') {
      playMissionFailed(audio);
      showEnd('MISI GAGAL', mission.failReason, `WAKTU ${mission.timerText}`);
    }

    if (shouldSmoke(state)) {
      const fwd = forwardVector(state);
      const enginePos = state.pos.clone().addScaledVector(fwd, 3.6);
      emitSmoke(effects, enginePos);
    }

    updateEffects(effects, dt, wind);
    updateSky(sky, dt, game.time);
    pulseNextRing(rings, mission, game.time);
    updateRingsVisual(rings, mission);
    updateAircraft(aircraft, state, activeInput, dt, game.time);
    updateCamera(cameraRig, state, { heightAt }, dt);
    updateGauges(gauges, state);
    updateAudio(audio, state);
    game.objectiveText = mission.objectiveText;
    updateHud(hud, game);
  }

  renderer.render(scene, camera);
  game.frames++;
  if (game.frames === 5) window.__poslangitReady = true;
}

// Menu backdrop: the plane sits on Merpati Field while the menu is up.
game.setCameraMode('chase');
showMenu();

// Screenshot scenarios start a real mission before the first frame.
const shot = shotFromUrl();
if (shot) {
  const target = applyShot(game, shot);
  if (shot === 'landing' && target) target.glide = true;
  if (target) game.autopilotTarget = target;
  hideOverlays();
}

requestAnimationFrame(frame);
