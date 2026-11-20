// Synthesized audio (WebAudio, no external assets): night music loop + short SFX.
type Sfx = 'pickup' | 'lit' | 'pulse' | 'hit' | 'jump' | 'dash' | 'win' | 'lose' | 'shade' | 'tick' | 'wind' | 'charm' | 'steal';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicTimer: number | null = null;
let volume = 0.6;

function ensure(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    } catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setVolume(v: number) { volume = v; if (master) master.gain.value = v; }

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.2, delay = 0, slideTo?: number) {
  const c = ensure(); if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}

export function sfx(name: Sfx) {
  switch (name) {
    case 'pickup': tone(1320, 0.12, 'sine', 0.15); tone(1760, 0.1, 'sine', 0.1, 0.05); break;
    case 'lit': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, 'triangle', 0.18, i * 0.08)); break;
    case 'pulse': tone(300, 0.5, 'sine', 0.25, 0, 900); break;
    case 'hit': tone(180, 0.35, 'sawtooth', 0.2, 0, 70); break;
    case 'jump': tone(440, 0.15, 'square', 0.06, 0, 660); break;
    case 'dash': tone(900, 0.15, 'triangle', 0.1, 0, 300); break;
    case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.6, 'triangle', 0.18, i * 0.12)); break;
    case 'lose': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.6, 'sine', 0.18, i * 0.18)); break;
    case 'shade': tone(110, 0.8, 'sawtooth', 0.08, 0, 70); break;
    case 'tick': tone(1000, 0.06, 'square', 0.08); break;
    case 'wind': tone(200, 1.5, 'triangle', 0.05, 0, 420); break;
    case 'charm': [880, 1175, 1568].forEach((f, i) => tone(f, 0.25, 'sine', 0.12, i * 0.06)); break;
    case 'steal': tone(700, 0.3, 'triangle', 0.12, 0, 250); break;
  }
}

/** Soft pentatonic night loop. */
export function startMusic() {
  if (musicTimer !== null || !ensure()) return;
  const notes = [220, 262, 294, 330, 392, 440];
  let i = 0;
  musicTimer = window.setInterval(() => {
    tone(110, 1.6, 'sine', 0.05);
    tone(notes[(i * 7 + 3) % notes.length], 0.9, 'triangle', 0.035, 0.2);
    i++;
  }, 1600);
}
export function stopMusic() { if (musicTimer !== null) { clearInterval(musicTimer); musicTimer = null; } }
