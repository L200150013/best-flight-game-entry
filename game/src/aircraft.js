// aircraft.js — the "Merpati K-7" bush mail plane, built from three.js
// primitives: cream fuselage, red high wing, spinning prop with a blur
// disc, and control surfaces that visibly move with the pilot's inputs.
// No branding, no copied silhouette — a generic high-wing bush plane.

import * as THREE from 'three';
import { PALETTE } from './config.js';

export function buildAircraft() {
  const group = new THREE.Group();
  group.name = 'merpati-k7';
  const cream = new THREE.MeshLambertMaterial({ color: PALETTE.aircraftCream, flatShading: true });
  const red = new THREE.MeshLambertMaterial({ color: PALETTE.aircraftRed, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: PALETTE.aircraftDark, flatShading: true });
  const glass = new THREE.MeshLambertMaterial({
    color: 0x9fd4e8, flatShading: true, transparent: true, opacity: 0.22, depthWrite: false,
  });

  // Fuselage: a tapered cylinder along X, nose at +X.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 5.6, 10), cream);
  fuselage.rotation.z = Math.PI / 2;
  fuselage.position.set(-0.4, 0, 0);
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.6, 10), cream);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(3.2, 0, 0);
  group.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.4, 10), cream);
  tailCone.rotation.z = Math.PI / 2;
  tailCone.position.set(-4.2, 0.15, 0);
  group.add(tailCone);
  // Red cheatline stripe along the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.28, 2.02), red);
  stripe.position.set(-0.4, 0.15, 0);
  group.add(stripe);

  // Cabin: raised box with dark windows.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.7), cream);
  cabin.position.set(0.7, 0.85, 0);
  group.add(cabin);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 1.6), glass);
  windshield.position.set(1.75, 0.85, 0);
  windshield.rotation.z = -0.25;
  group.add(windshield);
  const sideWindowL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.08), glass);
  sideWindowL.position.set(0.7, 0.95, 0.88);
  group.add(sideWindowL);
  const sideWindowR = sideWindowL.clone();
  sideWindowR.position.z = -0.88;
  group.add(sideWindowR);

  // High wing with red tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 11.4), cream);
  wing.position.set(0.2, 1.45, 0);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.24, 0.9), red);
    tip.position.set(0.2, 1.45, side * 5.35);
    group.add(tip);
  }
  // Wing struts.
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.1, 6), dark);
    strut.position.set(0.5, 0.55, side * 2.4);
    strut.rotation.x = side * 0.55;
    group.add(strut);
  }

  // Tail: horizontal stabiliser + fin, both red-tipped.
  const stabiliser = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 4.2), cream);
  stabiliser.position.set(-5.0, 0.35, 0);
  group.add(stabiliser);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 0.18), red);
  fin.position.set(-5.0, 1.15, 0);
  fin.rotation.z = 0.35;
  group.add(fin);

  // Control surfaces (animated by updateAircraft).
  const aileronGeo = new THREE.BoxGeometry(0.7, 0.1, 1.7);
  const aileronL = new THREE.Mesh(aileronGeo, red);
  aileronL.position.set(-1.05, 1.42, 4.4);
  group.add(aileronL);
  const aileronR = new THREE.Mesh(aileronGeo, red);
  aileronR.position.set(-1.05, 1.42, -4.4);
  group.add(aileronR);
  const elevator = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 4.0), red);
  elevator.position.set(-5.75, 0.35, 0);
  group.add(elevator);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.7, 0.14), red);
  rudder.position.set(-5.6, 1.1, 0);
  group.add(rudder);

  // Propeller: hub + two blades + a translucent blur disc.
  const propGroup = new THREE.Group();
  propGroup.position.set(4.05, 0, 0);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8), dark);
  hub.rotation.z = Math.PI / 2;
  propGroup.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.12, 3.4, 0.3);
  const blade1 = new THREE.Mesh(bladeGeo, dark);
  propGroup.add(blade1);
  const blade2 = blade1.clone();
  blade2.rotation.x = Math.PI / 2;
  propGroup.add(blade2);
  const blurDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.85, 24),
    new THREE.MeshBasicMaterial({
      color: 0x888888, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false,
    })
  );
  blurDisc.rotation.y = Math.PI / 2;
  propGroup.add(blurDisc);
  group.add(propGroup);

  // Fixed landing gear: two mains + tail wheel.
  const gearGroup = new THREE.Group();
  gearGroup.name = 'gear';
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6), dark);
    strut.position.set(0.9, -1.35, side * 1.05);
    strut.rotation.x = side * 0.25;
    gearGroup.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.35, 12), dark);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(0.9, -2.05, side * 1.25);
    gearGroup.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 10), dark);
  tailWheel.rotation.x = Math.PI / 2;
  tailWheel.position.set(-4.6, -1.55, 0);
  gearGroup.add(tailWheel);
  group.add(gearGroup);

  // Mail cargo pod under the belly (the post this plane carries).
  const pod = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.2), red);
  pod.position.set(-0.2, -1.15, 0);
  group.add(pod);

  return {
    group,
    propGroup,
    blurDisc,
    aileronL,
    aileronR,
    elevator,
    rudder,
    gearGroup,
  };
}

// Pose the mesh from the flight state and the live inputs. The prop spins
// with rpm; at high rpm the blades fade into the blur disc.
export function updateAircraft(aircraft, state, input, dt, time) {
  const { group, propGroup, blurDisc, aileronL, aileronR, elevator, rudder, gearGroup } = aircraft;
  group.position.copy(state.pos);
  // The model faces +X; heading 0 is +X, so yaw = -heading in three.js.
  group.rotation.set(0, -state.heading, 0, 'YXZ');
  group.rotateZ(state.roll);
  group.rotateY(0);
  group.rotateX(0);
  // Apply pitch and roll in aircraft-local axes after yaw.
  group.rotation.order = 'YXZ';
  group.rotation.y = -state.heading;
  group.rotation.x = -state.pitch;
  group.rotation.z = state.roll;

  const rpm = state.engineOut ? 0 : 0.25 + state.throttle * 0.75;
  propGroup.rotation.x += dt * (4 + rpm * 55);
  blurDisc.material.opacity = state.engineOut ? 0 : 0.12 + rpm * 0.22;

  // Control surfaces follow the pilot's hands.
  aileronL.rotation.x = input.roll * 0.5;
  aileronR.rotation.x = -input.roll * 0.5;
  elevator.rotation.z = -input.pitch * 0.45;
  rudder.rotation.y = -input.rudder * 0.5;

  // Gear swings up when retracted; a bent gear (damage) hangs crooked.
  const gearTarget = state.gearDown ? 0 : -1.35;
  const bent = state.damage > 40 ? 0.25 : 0;
  gearGroup.rotation.z += (gearTarget + bent - gearGroup.rotation.z) * Math.min(1, dt * 3);

  // Engine vibration at high rpm, subtle so the camera never shakes.
  const vibe = rpm * rpm * 0.02;
  group.position.y += Math.sin(time * 47) * vibe;
}
