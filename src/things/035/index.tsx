"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudio, closeAudio } from "@/lib/audio";
import s from "./ambient.module.css";

type Layer = "rain" | "vinyl" | "train" | "cafe" | "fire" | "wind" | "night";

const LAYERS: { id: Layer; label: string }[] = [
  { id: "rain", label: "rain" },
  { id: "vinyl", label: "vinyl" },
  { id: "train", label: "train" },
  { id: "cafe", label: "cafe" },
  { id: "fire", label: "fire" },
  { id: "wind", label: "wind" },
  { id: "night", label: "night" },
];

interface Voice {
  gain: GainNode;
  stop: () => void;
}

/**
 * 035 — AMBIENT MACHINE
 *
 * Seven sounds, none of them recordings.
 *
 * Everything here is built out of filtered noise and a few oscillators —
 * rain is bright noise, a train is the same noise low and swaying, a
 * fire is noise with occasional spits, night is crickets made of tuned
 * blips. Stack them and it stops sounding like synthesis and starts
 * sounding like a place.
 */
export default function AmbientMachine() {
  const voicesRef = useRef(new Map<Layer, Voice>());
  const [levels, setLevels] = useState<Record<Layer, number>>({
    rain: 0,
    vinyl: 0,
    train: 0,
    cafe: 0,
    fire: 0,
    wind: 0,
    night: 0,
  });

  /** Two seconds of noise, reused by everything that needs it. */
  const noiseBuffer = useCallback((ac: AudioContext) => {
    const frames = Math.ceil(ac.sampleRate * 2);
    const buffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }, []);

  const build = useCallback(
    (id: Layer): Voice | null => {
      const ac = getAudio();
      if (!ac) return null;
      const gain = ac.createGain();
      gain.gain.value = 0;
      gain.connect(ac.destination);
      const stops: (() => void)[] = [];

      const noise = (filter: BiquadFilterNode, level = 1) => {
        const src = ac.createBufferSource();
        src.buffer = noiseBuffer(ac);
        src.loop = true;
        const g = ac.createGain();
        g.gain.value = level;
        src.connect(filter).connect(g).connect(gain);
        src.start();
        stops.push(() => src.stop());
        return src;
      };

      if (id === "rain") {
        const bp = ac.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 3200;
        bp.Q.value = 0.4;
        noise(bp, 0.5);
      }

      if (id === "vinyl") {
        // surface noise, plus a click once every rotation
        const hp = ac.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 2000;
        noise(hp, 0.12);
        const tick = window.setInterval(() => {
          const t = ac.currentTime;
          const pop = ac.createOscillator();
          pop.frequency.value = 60 + Math.random() * 90;
          const pg = ac.createGain();
          pg.gain.setValueAtTime(0.09, t);
          pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
          pop.connect(pg).connect(gain);
          pop.start(t);
          pop.stop(t + 0.04);
        }, 1800);
        stops.push(() => window.clearInterval(tick));
      }

      if (id === "train") {
        const lp = ac.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 260;
        noise(lp, 0.9);
        // the sway of the carriage
        const lfo = ac.createOscillator();
        lfo.frequency.value = 0.14;
        const depth = ac.createGain();
        depth.gain.value = 90;
        lfo.connect(depth).connect(lp.frequency);
        lfo.start();
        stops.push(() => lfo.stop());
        // and the joints in the rail
        const clack = window.setInterval(() => {
          const t = ac.currentTime;
          const src = ac.createBufferSource();
          src.buffer = noiseBuffer(ac);
          const f = ac.createBiquadFilter();
          f.type = "bandpass";
          f.frequency.value = 180;
          const g = ac.createGain();
          g.gain.setValueAtTime(0.14, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
          src.connect(f).connect(g).connect(gain);
          src.start(t);
          src.stop(t + 0.14);
        }, 1450);
        stops.push(() => window.clearInterval(clack));
      }

      if (id === "cafe") {
        // the murmur of people, which is noise with a mouth-shaped filter
        const bp = ac.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 520;
        bp.Q.value = 0.9;
        noise(bp, 0.7);
        const lfo = ac.createOscillator();
        lfo.frequency.value = 0.3;
        const depth = ac.createGain();
        depth.gain.value = 180;
        lfo.connect(depth).connect(bp.frequency);
        lfo.start();
        stops.push(() => lfo.stop());
        // cups
        const clink = window.setInterval(() => {
          if (Math.random() > 0.4) return;
          const t = ac.currentTime;
          const osc = ac.createOscillator();
          osc.frequency.value = 1800 + Math.random() * 1400;
          const g = ac.createGain();
          g.gain.setValueAtTime(0.05, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
          osc.connect(g).connect(gain);
          osc.start(t);
          osc.stop(t + 0.26);
        }, 2600);
        stops.push(() => window.clearInterval(clink));
      }

      if (id === "fire") {
        const lp = ac.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 500;
        noise(lp, 0.6);
        const spit = window.setInterval(() => {
          const t = ac.currentTime;
          const src = ac.createBufferSource();
          src.buffer = noiseBuffer(ac);
          const f = ac.createBiquadFilter();
          f.type = "bandpass";
          f.frequency.value = 1200 + Math.random() * 2400;
          const g = ac.createGain();
          g.gain.setValueAtTime(0.1, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
          src.connect(f).connect(g).connect(gain);
          src.start(t);
          src.stop(t + 0.06);
        }, 320);
        stops.push(() => window.clearInterval(spit));
      }

      if (id === "wind") {
        const bp = ac.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 700;
        bp.Q.value = 1.6;
        noise(bp, 0.8);
        const lfo = ac.createOscillator();
        lfo.frequency.value = 0.08;
        const depth = ac.createGain();
        depth.gain.value = 420;
        lfo.connect(depth).connect(bp.frequency);
        lfo.start();
        stops.push(() => lfo.stop());
      }

      if (id === "night") {
        // crickets: short tuned blips, slightly out of time with each other
        for (const [rate, freq] of [[420, 4600], [530, 5200], [670, 4200]] as [number, number][]) {
          const timer = window.setInterval(() => {
            if (Math.random() > 0.55) return;
            const t = ac.currentTime;
            for (let i = 0; i < 3; i++) {
              const osc = ac.createOscillator();
              osc.frequency.value = freq + Math.random() * 200;
              const g = ac.createGain();
              const at = t + i * 0.035;
              g.gain.setValueAtTime(0.03, at);
              g.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
              osc.connect(g).connect(gain);
              osc.start(at);
              osc.stop(at + 0.035);
            }
          }, rate * 2);
          stops.push(() => window.clearInterval(timer));
        }
      }

      return {
        gain,
        stop: () => {
          stops.forEach((fn) => {
            try {
              fn();
            } catch {
              // already stopped
            }
          });
          gain.disconnect();
        },
      };
    },
    [noiseBuffer],
  );

  const setLevel = useCallback(
    (id: Layer, value: number) => {
      setLevels((prev) => ({ ...prev, [id]: value }));
      const ac = getAudio();
      if (!ac) return;

      let voice = voicesRef.current.get(id);
      if (!voice && value > 0) {
        const made = build(id);
        if (!made) return;
        voicesRef.current.set(id, made);
        voice = made;
      }
      if (!voice) return;
      // ramp, so moving a fader never clicks
      voice.gain.gain.setTargetAtTime(value * 0.5, ac.currentTime, 0.08);
    },
    [build],
  );

  useEffect(
    () => () => {
      voicesRef.current.forEach((v) => v.stop());
      voicesRef.current.clear();
      closeAudio();
    },
    [],
  );

  const anyOn = Object.values(levels).some((v) => v > 0);

  return (
    <div className={s.stage}>
      <div className={s.rack}>
        {LAYERS.map((layer) => (
          <label key={layer.id} className={s.channel}>
            <input
              className={s.fader}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={levels[layer.id]}
              onChange={(e) => setLevel(layer.id, Number(e.target.value))}
            />
            <span
              className={`${s.label} ${levels[layer.id] > 0 ? s.labelOn : ""}`}
            >
              {layer.label}
            </span>
          </label>
        ))}
      </div>
      <p className={s.hint}>{anyOn ? "" : "bring something up"}</p>
    </div>
  );
}
