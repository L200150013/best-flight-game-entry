// hud-instruments.js — two faces of the same numbers: the DOM HUD
// (speed, altitude, heading, throttle, fuel, damage, objective) and the
// 3D cockpit gauges (airspeed, altimeter, heading) whose needles are real
// meshes driven by the flight state every frame.

import * as THREE from 'three';

function el(id) {
  return document.getElementById(id);
}

export function createHud() {
  return {
    spd: el('hud-spd'),
    alt: el('hud-alt'),
    hdg: el('hud-hdg'),
    thrFill: el('hud-thr-fill'),
    thrLabel: el('hud-thr-label'),
    fuelFill: el('hud-fuel-fill'),
    fuelLabel: el('hud-fuel-label'),
    dmgFill: el('hud-dmg-fill'),
    obj: el('hud-objective'),
    timer: el('hud-timer'),
    gear: el('hud-gear'),
    flaps: el('hud-flaps'),
    warn: el('hud-warn'),
    msg: el('hud-msg'),
    score: el('hud-score'),
  };
}

function fmt(n, digits = 0) {
  return n.toFixed(digits);
}

export function updateHud(hud, game) {
  const s = game.state;
  const m = game.mission;
  if (hud.spd) hud.spd.textContent = fmt(Math.max(0, s.speed * 1.94384)); // knots
  if (hud.alt) hud.alt.textContent = fmt(Math.max(0, s.pos.y - game.groundY) * 3.28084); // feet AGL
  if (hud.hdg) hud.hdg.textContent = String(Math.round(((s.heading * 180) / Math.PI % 360 + 360) % 360)).padStart(3, '0');
  if (hud.thrFill) hud.thrFill.style.width = `${Math.round(s.throttle * 100)}%`;
  if (hud.thrLabel) hud.thrLabel.textContent = `THR ${Math.round(s.throttle * 100)}%`;
  if (hud.fuelFill) {
    hud.fuelFill.style.width = `${Math.max(0, s.fuel)}%`;
    hud.fuelFill.classList.toggle('low', s.fuel < 25);
  }
  if (hud.fuelLabel) hud.fuelLabel.textContent = `FUEL ${Math.round(s.fuel)}%`;
  if (hud.dmgFill) {
    hud.dmgFill.style.width = `${Math.round(s.damage)}%`;
    hud.dmgFill.classList.toggle('bad', s.damage > 40);
  }
  if (hud.obj) hud.obj.textContent = game.objectiveText;
  if (hud.timer) hud.timer.textContent = m.timerText;
  if (hud.gear) {
    hud.gear.textContent = s.gearDown ? 'GEAR DOWN' : 'GEAR UP';
    hud.gear.classList.toggle('on', s.gearDown);
  }
  if (hud.flaps) {
    hud.flaps.textContent = ['FLAPS UP', 'FLAPS 1', 'FLAPS 2'][s.flaps];
    hud.flaps.classList.toggle('on', s.flaps > 0);
  }
  if (hud.warn) {
    const warns = [];
    if (s.stalled) warns.push('STALL');
    if (s.overspeed) warns.push('OVERSPEED');
    if (s.fuel < 25 && s.fuel > 0) warns.push('LOW FUEL');
    if (s.fuel <= 0) warns.push('FUEL EMPTY — GLIDE');
    if (s.damage > 40) warns.push('DAMAGE');
    hud.warn.textContent = warns.join('  •  ');
    hud.warn.style.visibility = warns.length ? 'visible' : 'hidden';
  }
  if (hud.score) hud.score.textContent = game.scoreText || '';
}

// --- 3D cockpit gauges -------------------------------------------------------

function gaugeFace(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#10151a';
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8e4d8';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.stroke();
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

function ticks(ctx, count, fromDeg, toDeg, labels, majorEvery = 2) {
  ctx.fillStyle = '#e8e4d8';
  ctx.strokeStyle = '#e8e4d8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= count; i++) {
    const a = ((fromDeg + (toDeg - fromDeg) * (i / count)) * Math.PI) / 180;
    const major = i % majorEvery === 0;
    const r1 = major ? 96 : 104;
    const x1 = 128 + Math.sin(a) * r1;
    const y1 = 128 - Math.cos(a) * r1;
    const x2 = 128 + Math.sin(a) * 112;
    const y2 = 128 - Math.cos(a) * 112;
    ctx.lineWidth = major ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (labels && labels[i] !== undefined) {
      ctx.font = 'bold 26px system-ui, sans-serif';
      const lx = 128 + Math.sin(a) * 74;
      const ly = 128 - Math.cos(a) * 74;
      ctx.fillText(String(labels[i]), lx, ly);
    }
  }
}

function makeGauge(faceTexture) {
  const group = new THREE.Group();
  const face = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.08, 28),
    new THREE.MeshLambertMaterial({ color: 0x22282e })
  );
  face.rotation.x = Math.PI / 2;
  group.add(face);
  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(0.39, 28),
    new THREE.MeshBasicMaterial({ map: faceTexture })
  );
  dial.position.z = 0.05;
  group.add(dial);
  // Needle: a thin red box pivoting at the dial centre.
  const needle = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.34, 0.015),
    new THREE.MeshBasicMaterial({ color: 0xff3b30 })
  );
  needle.geometry.translate(0, 0.145, 0);
  needle.position.z = 0.06;
  group.add(needle);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.04, 10),
    new THREE.MeshBasicMaterial({ color: 0xd8d2c0 })
  );
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.07;
  group.add(hub);
  return { group, needle };
}

export function buildCockpitGauges() {
  const airspeedFace = gaugeFace((ctx) => {
    ticks(ctx, 10, -120, 120, { 0: '0', 2: '20', 4: '40', 6: '60', 8: '80', 10: '100' });
    ctx.fillStyle = '#ff8c1a';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KNOTS', 128, 178);
    // Red line at Vne (78 m/s ≈ 152 kt is off-dial; mark 90 kt as caution).
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(128, 128, 112, ((72 - 120) * Math.PI) / 180, ((120 - 120) * Math.PI) / 180);
    ctx.stroke();
  });
  const altimeterFace = gaugeFace((ctx) => {
    ticks(ctx, 10, -120, 120, { 0: '0', 2: '1', 4: '2', 6: '3', 8: '4', 10: '5' });
    ctx.fillStyle = '#e8e4d8';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ALT ×100 FT', 128, 178);
  });
  const headingFace = gaugeFace((ctx) => {
    ticks(ctx, 12, 0, 360, { 0: 'N', 3: 'E', 6: 'S', 9: 'W' }, 3);
    ctx.fillStyle = '#e8e4d8';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HDG', 128, 178);
  });
  const airspeed = makeGauge(airspeedFace);
  const altimeter = makeGauge(altimeterFace);
  const heading = makeGauge(headingFace);
  airspeed.group.position.set(-0.72, 0.2, 0);
  altimeter.group.position.set(0, 0.2, 0);
  heading.group.position.set(0.72, 0.2, 0);
  return { airspeed, altimeter, heading };
}

// Build the dashboard panel the cockpit camera looks at: dark panel, three
// gauges, a compass strip and a small "POS LANGIT" placard.
export function buildDashboard(gauges) {
  const panel = new THREE.Group();
  panel.name = 'dashboard';
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.95, 0.12),
    new THREE.MeshLambertMaterial({ color: 0x1d242b })
  );
  panel.add(board);
  for (const g of [gauges.airspeed, gauges.altimeter, gauges.heading]) {
    g.group.position.z = 0.08;
    panel.add(g.group);
  }
  // Placard.
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = '#f2e6c9';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('POS LANGIT • K-7', 256, 52);
  const placard = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) })
  );
  placard.position.set(0, -0.34, 0.07);
  panel.add(placard);
  return panel;
}

// Needles: 0 at -120°, full scale at +120° measured clockwise around the
// dial, so the three.js rotation (counter-clockwise positive) is negated.
export function updateGauges(gauges, state) {
  const knots = Math.max(0, state.speed * 1.94384);
  gauges.airspeed.needle.rotation.z = THREE.MathUtils.degToRad(120 - (Math.min(100, knots) / 100) * 240);
  const altFt = Math.max(0, state.pos.y * 3.28084);
  gauges.altimeter.needle.rotation.z = THREE.MathUtils.degToRad(120 - (Math.min(500, altFt / 100) / 5) * 240);
  const hdgDeg = ((state.heading * 180) / Math.PI % 360 + 360) % 360;
  gauges.heading.needle.rotation.z = THREE.MathUtils.degToRad(-hdgDeg);
}
