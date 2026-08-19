/**
 * Tiny shared audio helpers.
 *
 * Contexts are created lazily on a real gesture so nothing is ever
 * running before the visitor asks for it, and `closeAudio` releases the
 * hardware when a thing unmounts.
 */

let ctx: AudioContext | null = null;

export function getAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function closeAudio() {
  ctx?.close();
  ctx = null;
}

/** Short filtered noise burst — mechanical clicks, switches, taps. */
export function click(opts: { freq?: number; gain?: number; decay?: number; q?: number } = {}) {
  const ac = getAudio();
  if (!ac) return;
  const { freq = 2200, gain = 0.25, decay = 0.045, q = 1.4 } = opts;

  const frames = Math.ceil(ac.sampleRate * decay);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 3;
  }

  const src = ac.createBufferSource();
  src.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;

  const amp = ac.createGain();
  amp.gain.value = gain;

  src.connect(filter).connect(amp).connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + decay);
}

/** Small servo whir for moving mechanisms. */
export function whir(duration = 0.38, base = 92) {
  const ac = getAudio();
  if (!ac) return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(base, now);
  osc.frequency.linearRampToValueAtTime(base * 1.22, now + duration);

  const lfo = ac.createOscillator();
  lfo.frequency.value = 34;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 9;
  lfo.connect(lfoGain).connect(osc.frequency);

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;

  const amp = ac.createGain();
  amp.gain.setValueAtTime(0, now);
  amp.gain.linearRampToValueAtTime(0.075, now + 0.04);
  amp.gain.setValueAtTime(0.075, now + duration - 0.06);
  amp.gain.linearRampToValueAtTime(0, now + duration);

  osc.connect(filter).connect(amp).connect(ac.destination);
  osc.start(now);
  lfo.start(now);
  osc.stop(now + duration);
  lfo.stop(now + duration);
}
