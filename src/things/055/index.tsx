"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudio, closeAudio } from "@/lib/audio";
import s from "./universe.module.css";

const TAU = Math.PI * 2;
const RUN = 60; // seconds, exactly

/** What happens, and when. */
const ERAS: { at: number; name: string }[] = [
  { at: 0, name: "everything, at once, from nothing" },
  { at: 3, name: "it is too hot for anything to hold together" },
  { at: 8, name: "the first particles find each other" },
  { at: 14, name: "gas, gathering" },
  { at: 21, name: "the first stars ignite" },
  { at: 29, name: "galaxies, turning" },
  { at: 36, name: "planets, out of the leftovers" },
  { at: 43, name: "something on one of them is alive" },
  { at: 49, name: "it builds things, briefly" },
  { at: 54, name: "the stars begin going out" },
  { at: 58, name: "cold, and very large, and quiet" },
];

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
  size: number;
  born: number;
}

/**
 * 055 — ONE MINUTE UNIVERSE
 *
 * Press the button and get exactly sixty seconds of everything: a hot
 * blank start, particles, gas, the first stars, galaxies turning, planets,
 * something alive on one of them, a brief run of building things, and
 * then the lights going out one at a time.
 *
 * It is the same sixty seconds every time and a different universe every
 * time — the eras are fixed, what happens inside them is not. Then it
 * asks whether you would like another one.
 */
export default function OneMinuteUniverse() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [era, setEra] = useState("");
  const [clock, setClock] = useState(0);
  const startRef = useRef(0);

  const begin = useCallback(() => {
    startRef.current = performance.now();
    setDone(false);
    setRunning(true);

    // one long tone that climbs for the whole minute and then stops
    const ac = getAudio();
    if (ac) {
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(40, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + RUN * 0.8);
      osc.frequency.exponentialRampToValueAtTime(30, now + RUN);
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 1.5);
      gain.gain.setValueAtTime(0.05, now + RUN - 6);
      gain.gain.linearRampToValueAtTime(0, now + RUN);
      osc.connect(gain).connect(ac.destination);
      osc.start(now);
      osc.stop(now + RUN + 0.4);
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const motes: Mote[] = [];
    let shown = "";
    let raf = 0;

    const frame = (now: number) => {
      const t = Math.min(RUN, (now - startRef.current) / 1000);
      setClock(t);

      const current = [...ERAS].reverse().find((e) => t >= e.at);
      if (current && current.name !== shown) {
        shown = current.name;
        setEra(current.name);
      }

      const cx = width / 2;
      const cy = height / 2;

      // the sky cools as it goes
      const heat = Math.max(0, 1 - t / 26);
      ctx.fillStyle = `rgba(${8 + heat * 26}, ${8 + heat * 8}, ${11 + heat * 6}, ${t < 1 ? 1 : 0.16})`;
      ctx.fillRect(0, 0, width, height);

      // --- the eras, as one continuous process ---------------------
      if (t < 3) {
        // too hot to be anything
        const flash = 1 - t / 3;
        ctx.fillStyle = `rgba(255, ${200 + flash * 55}, ${160 + flash * 90}, ${flash * 0.9})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 30 + t * 340, 0, TAU);
        ctx.fill();
      }

      // particles arrive, then stop arriving
      if (t > 2 && t < 22 && motes.length < 900) {
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * TAU;
          const r = 40 + Math.random() * Math.min(width, height) * 0.5;
          motes.push({
            x: cx + Math.cos(a) * r,
            y: cy + Math.sin(a) * r,
            vx: -Math.sin(a) * (12 + Math.random() * 26),
            vy: Math.cos(a) * (12 + Math.random() * 26),
            hue: 20 + Math.random() * 40,
            size: 0.6 + Math.random() * 1.5,
            born: t,
          });
        }
      }

      for (const m of motes) {
        // everything falls toward the middle, and misses
        const dx = cx - m.x;
        const dy = cy - m.y;
        const d2 = Math.max(400, dx * dx + dy * dy);
        const pull = 2600 / d2;
        m.vx += dx * pull * 0.016;
        m.vy += dy * pull * 0.016;
        m.x += m.vx * 0.016;
        m.y += m.vy * 0.016;

        // stars ignite around twenty seconds in, and go blue-white
        const lit = t > 21;
        const dying = Math.max(0, (t - 52) / 8);
        const age = Math.min(1, (t - m.born) / 6);
        const hue = lit ? 40 - Math.min(30, (t - 21) * 2) : m.hue;
        const light = lit ? 74 - dying * 60 : 40;
        ctx.fillStyle = `hsl(${hue} ${lit ? 40 : 60}% ${Math.max(4, light)}% / ${age * (1 - dying * 0.9)})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size * (lit ? 1.5 : 1), 0, TAU);
        ctx.fill();
      }

      // a galaxy's worth of rotation, once there are enough of them
      if (t > 28 && t < 54) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((t - 28) * 0.02);
        ctx.strokeStyle = `rgba(180, 190, 220, ${0.03 * Math.min(1, (t - 28) / 6)})`;
        ctx.lineWidth = 40;
        for (let arm = 0; arm < 2; arm++) {
          ctx.beginPath();
          for (let k = 0; k < 90; k++) {
            const a = arm * Math.PI + k * 0.06;
            const r = k * 4.4;
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r * 0.6;
            if (k === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      // one small blue thing, for six seconds
      if (t > 42 && t < 52) {
        const a = (t - 42) * 0.6;
        const px = cx + Math.cos(a) * 150;
        const py = cy + Math.sin(a) * 90;
        ctx.fillStyle = "#6fa8c9";
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, TAU);
        ctx.fill();
        if (t > 48) {
          // and briefly, lights on it
          ctx.fillStyle = `rgba(255, 214, 150, ${Math.min(1, (t - 48) / 2) * 0.9})`;
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, TAU);
          ctx.fill();
        }
      }

      if (t >= RUN) {
        setRunning(false);
        setDone(true);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [running]);

  useEffect(() => closeAudio, []);

  return (
    <div className={s.stage}>
      <canvas ref={canvasRef} className={s.canvas} />

      {!running && !done ? (
        <button className={s.create} onClick={begin}>
          create universe
        </button>
      ) : null}

      {running ? (
        <>
          <span className={s.era} key={era}>
            {era}
          </span>
          <span className={s.clock}>{String(Math.floor(RUN - clock)).padStart(2, "0")}</span>
        </>
      ) : null}

      {done ? (
        <div className={s.end}>
          <p className={s.epitaph}>that was all of it</p>
          <button className={s.create} onClick={begin}>
            again?
          </button>
        </div>
      ) : null}
    </div>
  );
}
