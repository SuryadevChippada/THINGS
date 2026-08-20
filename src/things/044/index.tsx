"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudio, closeAudio } from "@/lib/audio";
import s from "./composer.module.css";

const TAU = Math.PI * 2;
/** Pentatonic again, because rain should not be able to play a wrong note. */
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const ROOT = 261.63;

interface Emitter {
  x: number;
  y: number;
  /** Seconds between drops — a higher emitter falls for longer. */
  period: number;
  next: number;
  note: number;
}

interface Drop {
  x: number;
  y: number;
  vy: number;
  note: number;
}

interface Splash {
  x: number;
  life: number;
  note: number;
}

/**
 * 044 — RAIN COMPOSER
 *
 * Hang droplets in the air. They fall, and when they land they play.
 *
 * Height is the only instrument here: a drop placed higher takes longer
 * to arrive, so it plays later and lower down the beat — which means the
 * rhythm is literally the shape you drew. Leave it running and it loops
 * forever without ever quite repeating.
 */
export default function RainComposer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const emittersRef = useRef<Emitter[]>([]);
  const [count, setCount] = useState(0);

  const play = useCallback((note: number) => {
    const ac = getAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = ROOT * Math.pow(2, SCALE[note % SCALE.length] / 12);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    // a touch of body, so it reads as a drop rather than a beep
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = osc.frequency.value * 1.6;
    filter.Q.value = 1.2;
    osc.connect(filter).connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 1.2);
  }, []);

  useEffect(() => {
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

    const drops: Drop[] = [];
    const splashes: Splash[] = [];
    const floor = () => height - 80;

    const onDown = (e: PointerEvent) => {
      if (e.clientY > floor() - 20) return;
      // pitch comes from where across the screen you put it
      const note = Math.floor((e.clientX / width) * SCALE.length);
      emittersRef.current.push({
        x: e.clientX,
        y: e.clientY,
        period: 1.6 + Math.random() * 2.4,
        next: 0,
        note,
      });
      setCount(emittersRef.current.length);
    };
    canvas.addEventListener("pointerdown", onDown);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const ground = floor();

      for (const em of emittersRef.current) {
        em.next -= dt;
        if (em.next <= 0) {
          em.next = em.period;
          drops.push({ x: em.x, y: em.y, vy: 0, note: em.note });
        }
      }

      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.vy += 620 * dt;
        d.y += d.vy * dt;
        if (d.y >= ground) {
          splashes.push({ x: d.x, life: 1, note: d.note });
          play(d.note);
          drops.splice(i, 1);
        }
      }

      ctx.clearRect(0, 0, width, height);

      // the surface it lands on
      ctx.strokeStyle = "rgba(214,209,201,0.16)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, ground);
      ctx.lineTo(width, ground);
      ctx.stroke();

      // emitters, pulsing as their next drop approaches
      for (const em of emittersRef.current) {
        const due = 1 - em.next / em.period;
        ctx.strokeStyle = `rgba(201,135,92,${0.24 + due * 0.5})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(em.x, em.y, 7 + due * 3, 0, TAU);
        ctx.stroke();
        // a hairline showing where it will land
        ctx.strokeStyle = "rgba(214,209,201,0.05)";
        ctx.beginPath();
        ctx.moveTo(em.x, em.y + 10);
        ctx.lineTo(em.x, ground);
        ctx.stroke();
      }

      for (const d of drops) {
        const stretch = Math.min(14, 3 + d.vy * 0.014);
        ctx.fillStyle = "rgba(206,224,238,0.85)";
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, 2, stretch, 0, 0, TAU);
        ctx.fill();
      }

      for (let i = splashes.length - 1; i >= 0; i--) {
        const sp = splashes[i];
        sp.life -= dt * 1.6;
        if (sp.life <= 0) {
          splashes.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(201,135,92,${sp.life * 0.6})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(sp.x, ground, (1 - sp.life) * 34, (1 - sp.life) * 9, 0, 0, TAU);
        ctx.stroke();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      closeAudio();
    };
  }, [play]);

  return (
    <div className={s.stage}>
      <canvas ref={canvasRef} className={s.canvas} />
      <div className={s.hud}>
        <span>{count === 0 ? "click the air" : `${count} droplets`}</span>
        {count > 0 ? (
          <button
            className={s.button}
            onClick={() => {
              emittersRef.current = [];
              setCount(0);
            }}
          >
            clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
