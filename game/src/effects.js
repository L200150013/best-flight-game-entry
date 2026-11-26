// effects.js — the visible feedback: engine smoke when damaged, dust
// bursting on touchdown, and the next ring pulsing so the route reads at
// a glance. All particles are recycled; nothing allocates per frame.

import * as THREE from 'three';

export function createEffects(scene) {
  // Smoke: a Points cloud of 70 puffs, recycled in a ring buffer.
  const smokeCount = 70;
  const smokeGeo = new THREE.BufferGeometry();
  const smokePos = new Float32Array(smokeCount * 3);
  const smokeLife = new Float32Array(smokeCount); // 0 = dead
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  const smokeMat = new THREE.PointsMaterial({
    color: 0x3a3f45, size: 3.2, transparent: true, opacity: 0.55, depthWrite: false,
  });
  const smoke = new THREE.Points(smokeGeo, smokeMat);
  smoke.frustumCulled = false;
  scene.add(smoke);

  // Dust: 40 puffs for touchdown, same recycling.
  const dustCount = 40;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustLife = new Float32Array(dustCount);
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xcbb98a, size: 2.4, transparent: true, opacity: 0.7, depthWrite: false,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  return {
    smoke, smokePos, smokeLife, smokeCursor: 0,
    dust, dustPos, dustLife, dustCursor: 0,
  };
}

function spawn(effects, which, origin, spread, count) {
  const pos = which === 'smoke' ? effects.smokePos : effects.dustPos;
  const life = which === 'smoke' ? effects.smokeLife : effects.dustLife;
  const total = life.length;
  let cursor = which === 'smoke' ? effects.smokeCursor : effects.dustCursor;
  for (let n = 0; n < count; n++) {
    const i = cursor % total;
    cursor++;
    pos[i * 3] = origin.x + (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * spread * 0.5;
    pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * spread;
    life[i] = 1;
  }
  if (which === 'smoke') effects.smokeCursor = cursor;
  else effects.dustCursor = cursor;
}

export function emitSmoke(effects, origin) {
  spawn(effects, 'smoke', origin, 1.2, 2);
}

export function emitDustBurst(effects, origin) {
  spawn(effects, 'dust', origin, 4, 18);
}

export function updateEffects(effects, dt, wind) {
  // Age the puffs: they rise, drift with the wind and fade by shrinking life.
  for (let i = 0; i < effects.smokeLife.length; i++) {
    if (effects.smokeLife[i] <= 0) {
      effects.smokePos[i * 3 + 1] = -100; // park dead puffs below the sea
      continue;
    }
    effects.smokeLife[i] -= dt * 0.55;
    effects.smokePos[i * 3] += wind.x * dt * 0.5;
    effects.smokePos[i * 3 + 1] += dt * 2.2;
    effects.smokePos[i * 3 + 2] += wind.z * dt * 0.5;
  }
  effects.smoke.geometry.attributes.position.needsUpdate = true;
  effects.smoke.material.opacity = 0.5;
  for (let i = 0; i < effects.dustLife.length; i++) {
    if (effects.dustLife[i] <= 0) {
      effects.dustPos[i * 3 + 1] = -100;
      continue;
    }
    effects.dustLife[i] -= dt * 1.4;
    effects.dustPos[i * 3] += wind.x * dt;
    effects.dustPos[i * 3 + 1] += dt * 0.8;
    effects.dustPos[i * 3 + 2] += wind.z * dt;
  }
  effects.dust.geometry.attributes.position.needsUpdate = true;
}

// Pulse the next ring so the route is obvious even in a still screenshot.
export function pulseNextRing(rings, mission, time) {
  if (!rings || mission.id !== 'rings' || mission.status !== 'flying') return;
  const mesh = rings.meshes[mission.nextRing];
  if (!mesh) return;
  const s = 1 + Math.sin(time * 5) * 0.05;
  mesh.scale.setScalar(s);
}
