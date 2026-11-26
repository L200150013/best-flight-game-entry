// input.js — one shared control state. Keyboard, mouse and the autopilot
// all write the same fields, so a scripted screenshot flies the same plane
// a player does. No input ever teleports the aircraft.

export function createInputState() {
  return {
    throttleUp: false,
    throttleDown: false,
    pitch: 0, // -1..1, + = nose up
    roll: 0, // -1..1, + = bank right
    rudder: 0, // -1..1, + = yaw right
    brakes: false,
    // Edge-triggered actions, consumed by main.js once per press.
    pressed: new Set(),
  };
}

const KEYMAP = {
  KeyW: 'throttleUp',
  ArrowUp: 'pitchDown',
  ArrowDown: 'pitchUp',
  KeyS: 'throttleDown',
  ArrowLeft: 'rollLeft',
  ArrowRight: 'rollRight',
  KeyA: 'rudderLeft',
  KeyD: 'rudderRight',
  KeyB: 'brakes',
};

export function bindInput(input, hooks) {
  const keys = new Set();
  const recompute = () => {
    input.throttleUp = keys.has('KeyW');
    input.throttleDown = keys.has('KeyS');
    input.pitch = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
    input.roll = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
    input.rudder = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    input.brakes = keys.has('KeyB');
  };
  // Note: W/S are throttle only; pitch lives on Up/Down arrows.
  const onKeyDown = (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    recompute();
    if (e.code === 'KeyF') input.pressed.add('flaps');
    if (e.code === 'KeyG') input.pressed.add('gear');
    if (e.code === 'KeyC') input.pressed.add('camera');
    if (e.code === 'KeyP') input.pressed.add('autopilot');
    if (e.code === 'KeyR') input.pressed.add('restart');
    if (e.code === 'Escape') input.pressed.add('pause');
    if (e.code === 'Digit1') input.pressed.add('mission-mail');
    if (e.code === 'Digit2') input.pressed.add('mission-rings');
    if (e.code === 'Digit3') input.pressed.add('mission-storm');
    if (e.code === 'Enter') input.pressed.add('confirm');
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    hooks.onFirstGesture?.();
  };
  const onKeyUp = (e) => {
    keys.delete(e.code);
    recompute();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Mouse: drag to look around in chase view; clicks hit DOM buttons.
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const canvas = hooks.canvas;
  if (canvas) {
    canvas.addEventListener('mousedown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      hooks.onLook?.((e.clientX - lastX) * 0.004, (e.clientY - lastY) * 0.003);
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    canvas.addEventListener('pointerdown', () => hooks.onFirstGesture?.());
  }
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}

// The autopilot writes the same fields a keyboard does: it holds heading,
// altitude and speed by asking for pitch, roll and throttle.
export function autopilotControl(state, target, dt) {
  const out = { throttleUp: false, throttleDown: false, pitch: 0, roll: 0, rudder: 0, brakes: false };
  // Heading hold: bank toward the target heading.
  let headingErr = target.heading - state.heading;
  while (headingErr > Math.PI) headingErr -= Math.PI * 2;
  while (headingErr < -Math.PI) headingErr += Math.PI * 2;
  const wantRoll = Math.max(-0.6, Math.min(0.6, headingErr * 1.4));
  out.roll = Math.max(-1, Math.min(1, (wantRoll - state.roll) * 2.2));
  // Altitude hold: pitch toward the target altitude, gentle near the ground.
  const altErr = target.altitude - state.pos.y;
  const wantPitch = Math.max(-0.3, Math.min(0.35, altErr * 0.012));
  out.pitch = Math.max(-1, Math.min(1, (wantPitch - state.pitch) * 2.5));
  // Speed hold: throttle toward the target speed.
  const speedErr = target.speed - state.speed;
  if (speedErr > 1.5) out.throttleUp = true;
  else if (speedErr < -1.5) out.throttleDown = true;
  return out;
}
