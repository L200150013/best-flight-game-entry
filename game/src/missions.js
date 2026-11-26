// missions.js — the three sorties of POS LANGIT. Each mission owns its
// spawn, its objective line, its win/lose checks and its timer text.
// Mail Run: land at three strips in order. Ring Rally: fly eight rings.
// Storm Landing: one soft touchdown in a crosswind on 25% fuel.

import * as THREE from 'three';
import { WORLD, MISSIONS, PALETTE } from './config.js';
import { stripById } from './terrain.js';

export function createMissionState() {
  return {
    id: null,
    status: 'menu', // 'menu' | 'flying' | 'won' | 'lost'
    timer: 0,
    timerText: '00:00',
    objectiveText: 'Pilih misi untuk terbang.',
    legsDone: 0,
    ringsDone: 0,
    nextRing: 0,
    targetStrip: null,
    failReason: '',
    winText: '',
    scoreText: '',
  };
}

function stripSpawn(strip, offsetBack = 0) {
  const rad = (strip.headingDeg * Math.PI) / 180;
  return {
    x: strip.x - Math.cos(rad) * offsetBack,
    y: strip.elev + 1.15,
    z: strip.z - Math.sin(rad) * offsetBack,
    heading: rad,
    speed: 0,
    throttle: 0,
    onGround: true,
  };
}

export function missionSpawn(missionId) {
  if (missionId === 'rings') {
    const strip = stripById('merpati');
    return stripSpawn(strip, -120); // start on the runway, rings ahead
  }
  if (missionId === 'storm') {
    const strip = stripById(MISSIONS.storm.targetStrip);
    const rad = (strip.headingDeg * Math.PI) / 180;
    // Final approach: 700 m out, 110 m up, already configured to land.
    return {
      x: strip.x - Math.cos(rad) * 700,
      y: strip.elev + 110,
      z: strip.z - Math.sin(rad) * 700,
      heading: rad,
      speed: 42,
      throttle: 0.45,
      onGround: false,
    };
  }
  return stripSpawn(stripById(MISSIONS.mail.startStrip), 0);
}

export function startMission(mission, missionId, state) {
  mission.id = missionId;
  mission.status = 'flying';
  mission.timer = 0;
  mission.legsDone = 0;
  mission.ringsDone = 0;
  mission.nextRing = 0;
  mission.failReason = '';
  mission.winText = '';
  mission.scoreText = '';
  if (missionId === 'mail') {
    mission.targetStrip = stripById(MISSIONS.mail.legs[0]);
    mission.objectiveText = `ANTAR PAKET 1/3 — tujuan: ${mission.targetStrip.name}`;
  } else if (missionId === 'rings') {
    mission.objectiveText = 'RING RALLY — terbang melewati ring 1/8';
  } else {
    mission.targetStrip = stripById(MISSIONS.storm.targetStrip);
    mission.objectiveText = `STORM LANDING — mendarat di ${mission.targetStrip.name}, crosswind!`;
  }
  state.fuel = MISSIONS[missionId].fuelStart;
  state.damage = 0;
  state.engineOut = false;
  if (missionId === 'storm') {
    state.gearDown = true;
    state.flaps = 2;
  } else {
    state.gearDown = true;
    state.flaps = 0;
  }
}

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function ringCenter(i) {
  const r = WORLD.rings[i];
  return new THREE.Vector3(r.x, r.y, r.z);
}

export function buildRings(scene) {
  const group = new THREE.Group();
  group.name = 'rings';
  const meshes = [];
  WORLD.rings.forEach((r, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(WORLD.ringRadius, 1.1, 10, 40),
      new THREE.MeshLambertMaterial({
        color: PALETTE.ringNext,
        emissive: PALETTE.ringNext,
        emissiveIntensity: 0.55,
      })
    );
    ring.position.set(r.x, r.y, r.z);
    // Face the ring toward the previous ring so the pilot flies through it.
    const prev = i === 0 ? { x: 560, y: 60, z: 360 } : WORLD.rings[i - 1];
    ring.lookAt(prev.x, prev.y, prev.z);
    ring.userData.index = i;
    group.add(ring);
    meshes.push(ring);
    // A small floating number board under each ring.
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#20262c';
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), 64, 68);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, side: THREE.DoubleSide })
    );
    board.position.set(r.x, r.y - WORLD.ringRadius - 12, r.z);
    board.lookAt(prev.x, prev.y, prev.z);
    group.add(board);
  });
  scene.add(group);
  return { group, meshes };
}

export function updateRingsVisual(rings, mission) {
  rings.meshes.forEach((mesh, i) => {
    const mat = mesh.material;
    if (mission.id !== 'rings') {
      mat.color.setHex(PALETTE.ringNext);
      mat.emissive.setHex(PALETTE.ringNext);
      mat.emissiveIntensity = 0.25;
      return;
    }
    if (i < mission.ringsDone) {
      mat.color.setHex(PALETTE.ringDone);
      mat.emissive.setHex(PALETTE.ringDone);
      mat.emissiveIntensity = 0.7;
    } else if (i === mission.nextRing) {
      mat.color.setHex(PALETTE.ringNext);
      mat.emissive.setHex(PALETTE.ringNext);
      mat.emissiveIntensity = 0.9;
    } else {
      mat.color.setHex(0x8a94a0);
      mat.emissive.setHex(0x8a94a0);
      mat.emissiveIntensity = 0.15;
    }
  });
}

// One tick of mission logic. Returns an event for the game layer:
// 'checkpoint' | 'leg-done' | 'won' | 'lost' | null.
export function updateMission(mission, state, rings, dt, env) {
  if (mission.status !== 'flying') return null;
  mission.timer += dt;
  mission.timerText = fmtTime(mission.timer);

  if (mission.id === 'rings') {
    const target = ringCenter(mission.nextRing);
    const d = state.pos.distanceTo(target);
    if (d < WORLD.ringRadius * 0.95) {
      mission.ringsDone++;
      mission.nextRing++;
      if (mission.ringsDone >= WORLD.rings.length) {
        mission.status = 'won';
        mission.winText = `RING RALLY SELESAI — 8/8 ring dalam ${fmtTime(mission.timer)}!`;
        mission.scoreText = `WAKTU ${fmtTime(mission.timer)} • FUEL ${Math.round(state.fuel)}%`;
        return 'won';
      }
      mission.objectiveText = `RING RALLY — ring ${mission.ringsDone + 1}/8`;
      return 'checkpoint';
    }
    const remain = Math.round(d);
    mission.objectiveText = `RING RALLY — ring ${mission.ringsDone + 1}/8 • ${remain} m`;
    return null;
  }

  if (mission.id === 'mail') {
    const target = mission.targetStrip;
    const dx = state.pos.x - target.x;
    const dz = state.pos.z - target.z;
    const dist = Math.hypot(dx, dz);
    if (state.onGround && state.speed < 12 && dist < 170) {
      mission.legsDone++;
      if (mission.legsDone >= MISSIONS.mail.legs.length) {
        mission.status = 'won';
        mission.winText = `MAIL RUN SELESAI — 3 paket antar dalam ${fmtTime(mission.timer)}!`;
        mission.scoreText = `WAKTU ${fmtTime(mission.timer)} • FUEL ${Math.round(state.fuel)}% • DAMAGE ${Math.round(state.damage)}%`;
        return 'won';
      }
      mission.targetStrip = stripById(MISSIONS.mail.legs[mission.legsDone]);
      mission.objectiveText = `ANTAR PAKET ${mission.legsDone + 1}/3 — tujuan: ${mission.targetStrip.name}`;
      return 'leg-done';
    }
    mission.objectiveText = `ANTAR PAKET ${mission.legsDone + 1}/3 — ${target.name} • ${Math.round(dist)} m`;
    return null;
  }

  if (mission.id === 'storm') {
    const target = mission.targetStrip;
    const dx = state.pos.x - target.x;
    const dz = state.pos.z - target.z;
    const dist = Math.hypot(dx, dz);
    if (state.onGround) {
      if (state.speed < 14 && dist < 200 && state.lastTouchdownVs > -3.2) {
        mission.status = 'won';
        mission.winText = `STORM LANDING BERHASIL — touchdown ${Math.abs(state.lastTouchdownVs).toFixed(1)} m/s di tengah crosswind!`;
        mission.scoreText = `FUEL ${Math.round(state.fuel)}% • DAMAGE ${Math.round(state.damage)}%`;
        return 'won';
      }
      if (state.speed < 14 && (dist >= 200 || state.lastTouchdownVs <= -3.2)) {
        mission.status = 'lost';
        mission.failReason = dist >= 200 ? 'Overshoot — melewati runway.' : 'Touchdown terlalu keras.';
        return 'lost';
      }
    }
    mission.objectiveText = `STORM LANDING — ${target.name} • ${Math.round(dist)} m • crosswind!`;
    return null;
  }
  return null;
}
