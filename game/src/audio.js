// audio.js — every sound is synthesized with WebAudio: engine drone,
// wind rush, gear clunk, touchdown thud, checkpoint chime and warnings.
// No audio files, no network. Everything is guarded: a browser without
// audio (or a headless screenshot run) simply stays silent.

export function createAudio() {
  const audio = {
    ctx: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    windGain: null,
    windFilter: null,
    started: false,
  };
  return audio;
}

function ensureContext(audio) {
  if (audio.ctx) return true;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    audio.ctx = new Ctx();
    // Engine: a sawtooth plus a sub-octave square, through a low-pass.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 62;
    audio.engineOsc2 = audio.ctx.createOscillator();
    audio.engineOsc2.type = 'square';
    audio.engineOsc2.frequency.value = 31;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 480;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(filter);
    audio.engineOsc2.connect(filter);
    filter.connect(audio.engineGain);
    audio.engineGain.connect(audio.ctx.destination);
    audio.engineOsc.start();
    audio.engineOsc2.start();
    // Wind: looped noise through a band-pass whose gain follows airspeed.
    const len = audio.ctx.sampleRate * 2;
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = audio.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    audio.windFilter = audio.ctx.createBiquadFilter();
    audio.windFilter.type = 'bandpass';
    audio.windFilter.frequency.value = 700;
    audio.windGain = audio.ctx.createGain();
    audio.windGain.gain.value = 0;
    noise.connect(audio.windFilter);
    audio.windFilter.connect(audio.windGain);
    audio.windGain.connect(audio.ctx.destination);
    noise.start();
    return true;
  } catch (err) {
    audio.ctx = null;
    return false;
  }
}

export function startAudio(audio) {
  if (audio.started) return;
  if (!ensureContext(audio)) return;
  try {
    if (audio.ctx.state === 'suspended') void audio.ctx.resume();
    audio.started = true;
  } catch (err) { /* silent without audio */ }
}

// Called every frame: engine pitch follows rpm, wind follows airspeed.
export function updateAudio(audio, state) {
  if (!audio.ctx || !audio.started) return;
  try {
    const rpm = state.engineOut ? 0 : 0.25 + state.throttle * 0.75;
    const t = audio.ctx.currentTime;
    audio.engineOsc.frequency.setTargetAtTime(58 + rpm * 95, t, 0.08);
    audio.engineOsc2.frequency.setTargetAtTime(29 + rpm * 47, t, 0.08);
    audio.engineGain.gain.setTargetAtTime(state.onGround && state.speed < 2 ? 0.015 : 0.03 + rpm * 0.075, t, 0.1);
    const wind = Math.min(1, state.speed / 80);
    audio.windGain.gain.setTargetAtTime(wind * wind * 0.11, t, 0.15);
    audio.windFilter.frequency.setTargetAtTime(420 + state.speed * 9, t, 0.15);
  } catch (err) { /* keep flying even if audio dies */ }
}

function blip(audio, freq, dur, gain, type = 'sine') {
  if (!audio.ctx || !audio.started) return;
  try {
    const osc = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, audio.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
    osc.connect(g);
    g.connect(audio.ctx.destination);
    osc.start();
    osc.stop(audio.ctx.currentTime + dur);
  } catch (err) { /* silent */ }
}

export function playCheckpoint(audio) {
  blip(audio, 880, 0.18, 0.12);
  setTimeout(() => blip(audio, 1318, 0.25, 0.12), 90);
}

export function playGearClunk(audio) {
  blip(audio, 140, 0.12, 0.2, 'square');
}

export function playTouchdown(audio, hard) {
  blip(audio, hard ? 90 : 120, hard ? 0.3 : 0.15, hard ? 0.25 : 0.14, 'triangle');
}

export function playStallWarning(audio) {
  blip(audio, 520, 0.12, 0.08, 'square');
}

export function playMissionComplete(audio) {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(audio, f, 0.3, 0.12), i * 130));
}

export function playMissionFailed(audio) {
  [392, 330, 262].forEach((f, i) => setTimeout(() => blip(audio, f, 0.35, 0.1, 'triangle'), i * 160));
}
