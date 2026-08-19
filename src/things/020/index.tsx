"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudio, closeAudio } from "@/lib/audio";
import s from "./synth.module.css";

/** Two octaves of a pentatonic scale, so it is difficult to sound bad. */
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const KEYS = "asdfghjkl;'";
const ROOT = 174.61; // F3

type Knob = "warmth" | "panic" | "dust" | "space" | "wobble";

const KNOBS: { id: Knob; label: string; hint: string }[] = [
  { id: "warmth", label: "WARMTH", hint: "how much of the top end survives" },
  { id: "panic", label: "PANIC", hint: "how badly it is holding it together" },
  { id: "dust", label: "DUST", hint: "how long since anyone cleaned it" },
  { id: "space", label: "SPACE", hint: "how far away the room is" },
  { id: "wobble", label: "WOBBLE", hint: "how loose the tape is" },
];

/**
 * 020 — TINY SYNTH
 *
 * A small synthesiser with five knobs, none of which are called cutoff or
 * resonance. It is a real signal chain — oscillators through a filter,
 * through a delay, out — but the controls are named after what the sound
 * feels like rather than what the node does, because that is the only
 * thing anyone actually adjusts by.
 *
 * Play with the home row, or the keys on screen.
 */
export default function TinySynth() {
  const [knobs, setKnobs] = useState<Record<Knob, number>>({
    warmth: 0.55,
    panic: 0.15,
    dust: 0.2,
    space: 0.4,
    wobble: 0.25,
  });
  const [held, setHeld] = useState<number[]>([]);

  const knobsRef = useRef(knobs);
  useEffect(() => {
    knobsRef.current = knobs;
  }, [knobs]);

  /** Built lazily, on the first note, and torn down on the way out. */
  const rigRef = useRef<{
    filter: BiquadFilterNode;
    delay: DelayNode;
    feedback: GainNode;
    wet: GainNode;
    out: GainNode;
    lfo: OscillatorNode;
    lfoDepth: GainNode;
    hiss: AudioBufferSourceNode;
    hissGain: GainNode;
  } | null>(null);

  const voicesRef = useRef(new Map<number, { osc: OscillatorNode[]; gain: GainNode }>());

  const rig = useCallback(() => {
    if (rigRef.current) return rigRef.current;
    const ac = getAudio();
    if (!ac) return null;

    const out = ac.createGain();
    out.gain.value = 0.5;
    out.connect(ac.destination);

    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 1.6;

    const delay = ac.createDelay(1.2);
    delay.delayTime.value = 0.28;
    const feedback = ac.createGain();
    const wet = ac.createGain();
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(out);

    filter.connect(out);
    filter.connect(delay);

    // one shared vibrato, so every voice wobbles together like real tape
    const lfo = ac.createOscillator();
    lfo.frequency.value = 5.2;
    const lfoDepth = ac.createGain();
    lfo.connect(lfoDepth);
    lfo.start();

    // and a permanent layer of dirt
    const frames = Math.ceil(ac.sampleRate * 2);
    const buffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const hiss = ac.createBufferSource();
    hiss.buffer = buffer;
    hiss.loop = true;
    const hissGain = ac.createGain();
    hissGain.gain.value = 0;
    const hissFilter = ac.createBiquadFilter();
    hissFilter.type = "highpass";
    hissFilter.frequency.value = 1400;
    hiss.connect(hissFilter).connect(hissGain).connect(out);
    hiss.start();

    rigRef.current = { filter, delay, feedback, wet, out, lfo, lfoDepth, hiss, hissGain };
    return rigRef.current;
  }, []);

  /** Push the knob positions into the graph. */
  const apply = useCallback(() => {
    const r = rigRef.current;
    if (!r) return;
    const k = knobsRef.current;
    r.filter.frequency.value = 240 + (1 - k.warmth) ** 2 * 7200;
    r.filter.Q.value = 0.8 + k.panic * 11;
    r.hissGain.gain.value = k.dust * 0.035;
    r.wet.gain.value = k.space * 0.5;
    r.feedback.gain.value = k.space * 0.62;
    r.delay.delayTime.value = 0.1 + k.space * 0.42;
    r.lfoDepth.gain.value = k.wobble * 26 + k.panic * 40;
    r.lfo.frequency.value = 3 + k.wobble * 7 + k.panic * 14;
  }, []);

  useEffect(() => {
    apply();
  }, [knobs, apply]);

  const press = useCallback(
    (index: number) => {
      if (voicesRef.current.has(index)) return;
      const r = rig();
      const ac = getAudio();
      if (!r || !ac) return;
      apply();

      const freq = ROOT * Math.pow(2, SCALE[index] / 12);
      const k = knobsRef.current;
      const now = ac.currentTime;

      const gain = ac.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.012);
      gain.connect(r.filter);

      // two oscillators, slightly out with each other — panic widens the gap
      const osc: OscillatorNode[] = [];
      for (const [i, detune] of [-1, 1].entries()) {
        const o = ac.createOscillator();
        o.type = i === 0 ? "sawtooth" : "triangle";
        o.frequency.value = freq;
        o.detune.value = detune * (4 + k.panic * 55);
        r.lfoDepth.connect(o.detune);
        o.connect(gain);
        o.start(now);
        osc.push(o);
      }

      voicesRef.current.set(index, { osc, gain });
      setHeld((h) => (h.includes(index) ? h : [...h, index]));
    },
    [rig, apply],
  );

  const release = useCallback((index: number) => {
    const voice = voicesRef.current.get(index);
    const ac = getAudio();
    if (!voice || !ac) return;
    const now = ac.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + 0.34);
    voice.osc.forEach((o) => o.stop(now + 0.36));
    voicesRef.current.delete(index);
    setHeld((h) => h.filter((i) => i !== index));
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey) return;
      const i = KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0) press(i);
    };
    const up = (e: KeyboardEvent) => {
      const i = KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0) release(i);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [press, release]);

  useEffect(
    () => () => {
      voicesRef.current.forEach((v) => v.osc.forEach((o) => o.stop()));
      voicesRef.current.clear();
      rigRef.current = null;
      closeAudio();
    },
    [],
  );

  return (
    <div className={s.stage}>
      <div className={s.box}>
        <div className={s.knobs}>
          {KNOBS.map((knob) => (
            <label key={knob.id} className={s.knob} title={knob.hint}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={knobs[knob.id]}
                onChange={(e) =>
                  setKnobs((prev) => ({ ...prev, [knob.id]: Number(e.target.value) }))
                }
              />
              <span className={s.knobLabel}>{knob.label}</span>
            </label>
          ))}
        </div>

        <div className={s.keys}>
          {SCALE.map((_, i) => (
            <button
              key={i}
              className={`${s.key} ${held.includes(i) ? s.keyOn : ""}`}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                press(i);
              }}
              onPointerUp={() => release(i)}
              onPointerLeave={() => release(i)}
              aria-label={`note ${i + 1}`}
            >
              <span>{KEYS[i]}</span>
            </button>
          ))}
        </div>

        <p className={s.hint}>home row, or press the keys</p>
      </div>
    </div>
  );
}
