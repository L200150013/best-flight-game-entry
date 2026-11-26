// sky.js — one consistent sky: a gradient dome, a low sun, and flat
// drifting cloud cards in the same low-poly language as the terrain.

import * as THREE from 'three';
import { PALETTE } from './config.js';

export function createSky(scene) {
  // Gradient dome: a big sphere, BackSide, vertex colours top to horizon.
  const domeGeo = new THREE.SphereGeometry(4200, 24, 14);
  const top = new THREE.Color(PALETTE.skyTop);
  const horizon = new THREE.Color(PALETTE.skyHorizon);
  const colors = new Float32Array(domeGeo.attributes.position.count * 3);
  const pos = domeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, (pos.getY(i) / 4200) * 1.6 + 0.25));
    const c = horizon.clone().lerp(top, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  domeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(
    domeGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })
  );
  dome.name = 'skyDome';
  scene.add(dome);

  // Sun: a bright disc low in the west, plus a soft halo.
  const sunGroup = new THREE.Group();
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(150, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff3c0, fog: false })
  );
  sunGroup.add(sun);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(260, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.35, fog: false })
  );
  halo.position.z = -8;
  sunGroup.add(halo);
  sunGroup.position.set(-3200, 620, -1400);
  sunGroup.lookAt(0, 0, 0);
  scene.add(sunGroup);

  // Clouds: flat-shaded puffs of white icosahedra, drifting slowly east.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.92 });
  const clouds = [];
  const seeds = [
    [400, 420, -900, 3.2], [-700, 480, 300, 4.1], [1500, 380, 800, 2.6],
    [-1600, 520, -1200, 3.8], [2200, 450, -300, 3.0], [-300, 400, 1500, 2.8],
    [900, 540, 1400, 3.6], [-2200, 430, 600, 2.4], [300, 470, -1800, 3.4],
    [1800, 500, 1600, 2.9],
  ];
  for (const [x, y, z, s] of seeds) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(s);
    for (let i = 0; i < puffs; i++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(28 * s * (0.6 + (i % 3) * 0.25), 0), cloudMat);
      puff.position.set((i - puffs / 2) * 42 * s * 0.5, (i % 2) * 10 - 4, ((i * 37) % 50) - 25);
      puff.scale.y = 0.55;
      cloud.add(puff);
    }
    cloud.position.set(x, y, z);
    cloud.userData.speed = 2.2 + s * 0.4;
    scene.add(cloud);
    clouds.push(cloud);
  }
  return { dome, sunGroup, clouds };
}

export function updateSky(sky, dt, time) {
  for (const cloud of sky.clouds) {
    cloud.position.x += cloud.userData.speed * dt;
    if (cloud.position.x > 3000) cloud.position.x = -3000;
    cloud.position.y += Math.sin(time * 0.2 + cloud.position.z * 0.01) * dt * 0.4;
  }
  // Volcano smoke puffs drift and swell.
  const scene = sky.dome.parent;
  if (scene) {
    scene.traverse((obj) => {
      if (obj.name === 'volcanoSmoke') {
        obj.position.y += dt * 1.5;
        obj.position.x += dt * 3;
        const s = 1 + Math.sin(time * 0.5 + obj.position.y * 0.05) * 0.12;
        obj.scale.setScalar(s);
      }
    });
  }
}
