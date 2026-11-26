// terrain.js — the island chain: a deterministic heightfield, the sea,
// three airstrips with runways, a volcano, a lighthouse and villages.
// heightAt(x, z) is the single source of truth for ground collision.

import * as THREE from 'three';
import { WORLD, PALETTE } from './config.js';

// --- deterministic value noise (no Math.random: the world is identical every run) ---
function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

export function noise2(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  const ux = smooth(fx);
  const uz = smooth(fz);
  return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1;
}

function fbm(x, z) {
  return noise2(x, z) * 0.6 + noise2(x * 2.3, z * 2.3) * 0.28 + noise2(x * 5.1, z * 5.1) * 0.12;
}

function stripLocal(strip, x, z) {
  const rad = (strip.headingDeg * Math.PI) / 180;
  const dx = x - strip.x;
  const dz = z - strip.z;
  // Along-runway and across-runway coordinates.
  const along = dx * Math.cos(rad) + dz * Math.sin(rad);
  const across = -dx * Math.sin(rad) + dz * Math.cos(rad);
  return { along, across };
}

function flattenNearStrips(x, z, h) {
  for (const strip of WORLD.strips) {
    const { along, across } = stripLocal(strip, x, z);
    const halfLen = strip.runwayLength / 2;
    const halfWid = strip.runwayWidth / 2;
    // Radial plateau around the strip itself.
    const dAlong = Math.max(0, Math.abs(along) - halfLen);
    const dAcross = Math.max(0, Math.abs(across) - halfWid);
    const d = Math.hypot(dAlong, dAcross);
    const w = 1 - smooth(Math.min(1, Math.max(0, (d - 40) / 220)));
    if (w > 0) h = h * (1 - w) + strip.elev * w;
    // Flat approach corridor along the runway axis, so the strip stays
    // visible (and landable) from 700 m out on either end.
    const ca = Math.abs(along);
    const cw = Math.abs(across);
    const edge = Math.max((ca - 700) / 120, (cw - 130) / 80);
    const wc = 1 - smooth(Math.min(1, Math.max(0, edge)));
    if (wc > 0) {
      const corridorElev = strip.elev + Math.max(0, ca - 160) * 0.02;
      h = h * (1 - wc) + corridorElev * wc;
    }
  }
  return h;
}

export function heightAt(x, z) {
  let h = -6; // sea floor baseline
  for (const island of WORLD.islands) {
    const dx = x - island.x;
    const dz = z - island.z;
    const d = Math.hypot(dx, dz) / island.r;
    if (d >= 1) continue;
    const fall = Math.pow(1 - d * d, 1.6);
    h += island.peak * fall;
  }
  h += fbm(x * 0.004, z * 0.004) * 14 + fbm(x * 0.02, z * 0.02) * 3;
  h = flattenNearStrips(x, z, h);
  return h;
}

function groundColor(h, x, z) {
  const n = fbm(x * 0.01 + 7, z * 0.01 - 3) * 0.5 + 0.5;
  const c = new THREE.Color();
  if (h < 3.5) c.setHex(PALETTE.sand);
  else if (h < 55) c.setHex(n > 0.55 ? PALETTE.grass : PALETTE.grassDark);
  else if (h < 130) c.setHex(n > 0.5 ? PALETTE.forest : PALETTE.grassDark);
  else if (h < 210) c.setHex(PALETTE.rock);
  else c.setHex(PALETTE.volcano);
  // Gentle variation so the ground never reads flat.
  const v = 0.92 + n * 0.16;
  c.multiplyScalar(v);
  return c;
}

function buildRunway(scene, strip) {
  const group = new THREE.Group();
  const rad = (strip.headingDeg * Math.PI) / 180;
  const asphalt = new THREE.Mesh(
    new THREE.BoxGeometry(strip.runwayLength, 0.6, strip.runwayWidth),
    new THREE.MeshLambertMaterial({ color: PALETTE.runway })
  );
  asphalt.position.y = 0.3;
  group.add(asphalt);
  // Centreline dashes.
  const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.runwayLine });
  for (let d = -strip.runwayLength / 2 + 18; d < strip.runwayLength / 2 - 10; d += 24) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(12, 0.15, 1.2), dashMat);
    dash.position.set(d, 0.68, 0);
    group.add(dash);
  }
  // Threshold bars at both ends.
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(6, 0.15, 2.2), dashMat);
      bar.position.set(end * (strip.runwayLength / 2 - 8), 0.68, k * 3.4);
      group.add(bar);
    }
  }
  // Windsock: pole + orange cone pointing downwind.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 9, 6),
    new THREE.MeshLambertMaterial({ color: 0xdddddd })
  );
  pole.position.set(-strip.runwayLength / 2 - 14, 4.5, strip.runwayWidth / 2 + 10);
  group.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 4.5, 8),
    new THREE.MeshLambertMaterial({ color: 0xff7f1a })
  );
  sock.rotation.z = Math.PI / 2.4;
  sock.position.set(-strip.runwayLength / 2 - 12, 8.6, strip.runwayWidth / 2 + 10);
  group.add(sock);
  // Two hangars + a hut beside the strip.
  const hangarMat = new THREE.MeshLambertMaterial({ color: 0xb8452f });
  const hangar = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 16), hangarMat);
  hangar.position.set(10, 4, -strip.runwayWidth / 2 - 22);
  group.add(hangar);
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 8, 22, 12, 1, false, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0x8e2f20 })
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.set(10, 8, -strip.runwayWidth / 2 - 22);
  group.add(roof);
  const hut = new THREE.Mesh(
    new THREE.BoxGeometry(8, 5, 7),
    new THREE.MeshLambertMaterial({ color: 0xe8dcc0 })
  );
  hut.position.set(-30, 2.5, strip.runwayWidth / 2 + 20);
  group.add(hut);

  group.position.set(strip.x, strip.elev, strip.z);
  group.rotation.y = -rad;
  scene.add(group);
  return group;
}

function buildVolcano(scene) {
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(230, 350, 24, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.volcano, flatShading: true })
  );
  cone.position.set(-380, 165, -480);
  scene.add(cone);
  // Smoke column above the crater, drifting slowly.
  const smokeMat = new THREE.MeshLambertMaterial({
    color: 0xcfd4d6, transparent: true, opacity: 0.55, flatShading: true,
  });
  for (let i = 0; i < 5; i++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(16 - i * 1.5, 0), smokeMat);
    puff.position.set(-380 + i * 9, 350 + i * 22, -480 - i * 4);
    puff.name = 'volcanoSmoke';
    scene.add(puff);
  }
}

function buildLighthouse(scene) {
  const group = new THREE.Group();
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 5.5, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0xf5f0e0 })
  );
  tower.position.y = 13;
  group.add(tower);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.4, 4, 10),
    new THREE.MeshLambertMaterial({ color: PALETTE.aircraftRed })
  );
  band.position.y = 18;
  group.add(band);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(3, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8 })
  );
  lamp.position.y = 28;
  group.add(lamp);
  group.position.set(2450, heightAt(2450, 950) - 1, 950);
  scene.add(group);
}

function buildVillage(scene, x, z, count, seed) {
  for (let i = 0; i < count; i++) {
    const px = x + (hash2(seed + i * 3, seed) - 0.5) * 220;
    const pz = z + (hash2(seed, seed + i * 5) - 0.5) * 220;
    const gy = heightAt(px, pz);
    if (gy < 4) continue;
    const hut = new THREE.Group();
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(7, 4.5, 6),
      new THREE.MeshLambertMaterial({ color: i % 2 ? 0xe8dcc0 : 0xd8b98a })
    );
    walls.position.y = 2.2;
    hut.add(walls);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(5.6, 3.4, 4),
      new THREE.MeshLambertMaterial({ color: 0xa03a28, flatShading: true })
    );
    roof.position.y = 6;
    roof.rotation.y = Math.PI / 4;
    hut.add(roof);
    hut.position.set(px, gy - 0.4, pz);
    hut.rotation.y = hash2(i, seed) * Math.PI;
    scene.add(hut);
  }
}

export function createTerrain(scene) {
  const size = WORLD.size;
  const seg = WORLD.segments;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const c = groundColor(h, x, z);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  );
  ground.name = 'terrain';
  scene.add(ground);

  // Sea: one big teal plane just above y=0.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 2.4, size * 2.4),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.94 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0.4;
  sea.name = 'sea';
  scene.add(sea);

  // Scattered palm trees on the low ground near the strips.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.forest, flatShading: true });
  for (let i = 0; i < 90; i++) {
    const px = (hash2(i * 7, 11) - 0.5) * 5200;
    const pz = (hash2(13, i * 7) - 0.5) * 5200;
    const gy = heightAt(px, pz);
    if (gy < 4 || gy > 60) continue;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 5), trunkMat);
    trunk.position.y = 4.5;
    trunk.rotation.z = 0.12;
    tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(4.2, 0), leafMat);
    crown.position.y = 10.5;
    crown.scale.y = 0.7;
    tree.add(crown);
    tree.position.set(px, gy - 0.3, pz);
    scene.add(tree);
  }

  for (const strip of WORLD.strips) buildRunway(scene, strip);
  buildVolcano(scene);
  buildLighthouse(scene);
  buildVillage(scene, 620, 520, 10, 41);
  buildVillage(scene, 2050, -520, 8, 97);
  buildVillage(scene, -1700, 1080, 8, 153);
  return { ground, sea };
}

export function stripById(id) {
  return WORLD.strips.find((s) => s.id === id);
}

export function stripCenter(strip) {
  return new THREE.Vector3(strip.x, strip.elev, strip.z);
}

// True when (x,z) is over a runway rectangle, within `pad` metres of its edge.
export function overRunway(strip, x, z, pad = 0) {
  const { along, across } = stripLocal(strip, x, z);
  return Math.abs(along) <= strip.runwayLength / 2 + pad && Math.abs(across) <= strip.runwayWidth / 2 + pad;
}
