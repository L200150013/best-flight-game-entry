// camera.js — two cameras that never fight the pilot: a chase camera on
// a critically damped spring behind the plane, and a cockpit camera fixed
// to the pilot's head. Neither ever clips the terrain.

import * as THREE from 'three';
import { forwardVector } from './flight-model.js';

export function createCameraRig(camera) {
  return {
    camera,
    mode: 'chase', // 'chase' | 'cockpit'
    chasePos: new THREE.Vector3(),
    chaseLook: new THREE.Vector3(),
    initialized: false,
    // Mouse look offset (radians) applied to the chase camera only.
    lookYaw: 0,
    lookPitch: 0,
  };
}

export function setCameraMode(rig, mode) {
  rig.mode = mode;
  rig.initialized = false;
}

export function updateCamera(rig, state, env, dt) {
  const { camera } = rig;
  const fwd = forwardVector(state);
  const up = new THREE.Vector3(0, 1, 0);

  if (rig.mode === 'cockpit') {
    // Pilot's head: just behind the windshield, above the dashboard.
    const head = state.pos.clone().addScaledVector(fwd, 1.35).add(new THREE.Vector3(0, 1.18, 0));
    camera.position.copy(head);
    const look = head.clone().addScaledVector(fwd, 60);
    look.y += state.pitch * 12;
    camera.lookAt(look);
    // Bank the view with the aircraft, but only a third: full roll is nauseating.
    camera.rotateZ(state.roll * 0.35);
    rig.chasePos.copy(state.pos).addScaledVector(fwd, -16).add(new THREE.Vector3(0, 4.5, 0));
    return;
  }

  // Chase: spring-damped follow, 16 m back and 3.8 m up, offset 4 m to
  // the side for a three-quarter rear view that shows the fuselage.
  const side = new THREE.Vector3().crossVectors(fwd, up).normalize();
  const desired = state.pos.clone().addScaledVector(fwd, -16).add(new THREE.Vector3(0, 3.8, 0)).addScaledVector(side, 4);
  // Mouse look swings the camera around the aircraft without moving the plane.
  if (rig.lookYaw !== 0 || rig.lookPitch !== 0) {
    const side = new THREE.Vector3().crossVectors(fwd, up).normalize();
    desired.addScaledVector(side, Math.sin(rig.lookYaw) * 10);
    desired.y += rig.lookPitch * 6;
  }
  // Never let the camera sink into a hill.
  const groundY = env.heightAt(desired.x, desired.z);
  desired.y = Math.max(desired.y, groundY + 2.5);
  desired.y = Math.max(desired.y, 2.2);
  if (!rig.initialized) {
    rig.chasePos.copy(desired);
    rig.chaseLook.copy(state.pos).addScaledVector(fwd, 12);
    rig.initialized = true;
  }
  // Critically damped approach: fast enough to feel attached, never overshooting.
  const k = 1 - Math.exp(-dt * 4.2);
  rig.chasePos.lerp(desired, k);
  const lookTarget = state.pos.clone().addScaledVector(fwd, 14);
  const kLook = 1 - Math.exp(-dt * 6.0);
  rig.chaseLook.lerp(lookTarget, kLook);
  camera.position.copy(rig.chasePos);
  camera.lookAt(rig.chaseLook);
  camera.rotateZ(state.roll * 0.22);
}
