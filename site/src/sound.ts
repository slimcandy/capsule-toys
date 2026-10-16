// The machine's sounds, made on the spot with Web Audio: no files to load.
// "ambient" follows the phone's silent switch.

import type { Rarity } from "./catalog.ts";

let audio: AudioContext | null = null;

function context(): AudioContext | null {
  if (!audio) {
    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = "ambient";
      audio = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

/** A short burst of filtered noise: clicks, clunks, rattles. */
function noise(duration: number, frequency: number, gain: number, delay = 0) {
  const ctx = context();
  if (!ctx) return;
  const at = ctx.currentTime + delay;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = 2;
  const volume = ctx.createGain();
  volume.gain.value = gain;
  source.connect(filter).connect(volume).connect(ctx.destination);
  source.start(at);
}

function tone(frequency: number, duration: number, gain: number, delay = 0, type: OscillatorType = "sine") {
  const ctx = context();
  if (!ctx) return;
  const at = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  const volume = ctx.createGain();
  volume.gain.setValueAtTime(gain, at);
  volume.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(volume).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration);
}

export const sound = {
  /** Call on the first tap: browsers start audio only after one. */
  unlock: () => context(),
  /** One tooth of the knob's ratchet. */
  tick: () => noise(0.03, 3200, 0.5),
  /** The knob reaches its stop. */
  stop: () => {
    noise(0.05, 1800, 0.8);
    noise(0.04, 700, 0.5, 0.02);
  },
  /** The Play button, pressed. */
  press: () => noise(0.04, 1200, 0.6),
  /** The mechanism turns over. */
  clunk: () => {
    noise(0.12, 500, 1.2);
    noise(0.08, 1400, 0.6, 0.05);
  },
  /** Capsules rattling in the globe. */
  rattle: () => {
    for (let i = 0; i < 7; i++) noise(0.04, 2200 + Math.random() * 1800, 0.35, i * 0.07 + Math.random() * 0.03);
  },
  /** The capsule lands in the tray. */
  drop: () => {
    noise(0.06, 900, 0.9);
    noise(0.05, 1200, 0.4, 0.14);
  },
  /** The capsule pops open; brighter for rarer finds. */
  pop: (rarity: Rarity) => {
    noise(0.05, 4000, 0.6);
    const notes = rarity === "special" ? [784, 988, 1175, 1568] : rarity === "rare" ? [659, 880, 1109] : [587, 784];
    notes.forEach((n, i) => tone(n, 0.5, 0.12, 0.05 + i * 0.08, "triangle"));
  },
  /** The toy lands on the shelf. */
  shelf: () => noise(0.05, 1500, 0.4),
};
