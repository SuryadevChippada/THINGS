"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudio, closeAudio, click } from "@/lib/audio";
import s from "./fire.module.css";

const TAU = Math.PI * 2;

interface Log {
  x: number;
  y: number;
  angle: number;
  len: number;
  /** 1 is fresh, 0 is ash. Fuel decides how hard the fire burns. */
  fuel: number;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  heat: number;
}

/**
 * 031 — FIREPLACE.HTML
 *
 * A fire. Add logs, drag them about, and watch it work.
 *
 * The flames aren't a loop — they're drawn from the logs that are
 * actually there, so a fire with one spent log gutters and a fresh
 * armful roars. Logs burn down over several minutes and go to ash, and
 * then it is quiet again unless you do something about it.
 */
export default function Fireplace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logsRef = useRef<Log[]>([]);
  const [count, setCount] = useState(0);

  const addLog = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    logsRef.current.push({
      x: w / 2 + (Math.random() - 0.5) * 160,
      y: h * 0.72 - logsRef.current.length * 9 + (Math.random() - 0.5) * 10,
      angle: (Math.random() - 0.5) * 0.7,
      len: 130 + Math.random() * 70,
      fuel: 1,
    });
    setCount(logsRef.current.length);
    click({ freq: 240, gain: 0.3, decay: 0.16, q: 0.7 });
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

    // start it off with a couple of logs
    if (!logsRef.current.length) {
      logsRef.current.push(
        { x: width / 2 - 30, y: height * 0.72, angle: 0.2, len: 170, fuel: 1 },
        { x: width / 2 + 24, y: height * 0.72 - 10, angle: -0.35, len: 150, fuel: 1 },
      );
      setCount(2);
    }

    const embers: Ember[] = [];
    let dragging: Log | null = null;

    const logAt = (x: number, y: number) => {
      for (let i = logsRef.current.length - 1; i >= 0; i--) {
        const l = logsRef.current[i];
        if (Math.hypot(l.x - x, l.y - y) < l.len * 0.5) return l;
      }
      return null;
    };

    const onDown = (e: PointerEvent) => {
      dragging = logAt(e.clientX, e.clientY);
      if (dragging) canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      dragging.x = e.clientX;
      dragging.y = Math.min(height - 40, Math.max(height * 0.42, e.clientY));
    };
    const onUp = () => {
      dragging = null;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    // the crackle, and the low roar underneath it
    const ac = getAudio();
    let roarGain: GainNode | null = null;
    if (ac) {
      const frames = Math.ceil(ac.sampleRate * 3);
      const buffer = ac.createBuffer(1, frames, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 420;
      roarGain = ac.createGain();
      roarGain.gain.value = 0.04;
      src.connect(lp).connect(roarGain).connect(ac.destination);
      src.start();
    }

    let raf = 0;
    let last = performance.now();
    let nextCrackle = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const logs = logsRef.current;
      // logs burn down over a few minutes
      for (const l of logs) l.fuel = Math.max(0, l.fuel - dt * 0.0045);
      const heat = logs.reduce((sum, l) => sum + l.fuel, 0);

      if (roarGain) roarGain.gain.value = 0.012 + Math.min(0.06, heat * 0.022);

      // the occasional spit
      nextCrackle -= dt;
      if (nextCrackle <= 0 && heat > 0.1) {
        nextCrackle = 0.15 + Math.random() * (1.4 / Math.max(0.4, heat));
        click({ freq: 900 + Math.random() * 2200, gain: 0.05 + Math.random() * 0.07, decay: 0.04 });
      }

      ctx.clearRect(0, 0, width, height);

      // the glow the fire throws on the room
      if (heat > 0.02) {
        const cx = width / 2;
        const cy = height * 0.66;
        const reach = 200 + heat * 260;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
        const flicker = 0.55 + Math.sin(now / 90) * 0.06 + Math.sin(now / 37) * 0.04;
        glow.addColorStop(0, `rgba(255, 150, 60, ${0.16 * heat * flicker})`);
        glow.addColorStop(0.5, `rgba(200, 90, 40, ${0.07 * heat * flicker})`);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      }

      // the hearth
      ctx.fillStyle = "#131211";
      ctx.beginPath();
      ctx.ellipse(width / 2, height * 0.78, 260, 46, 0, 0, TAU);
      ctx.fill();

      // logs, charring as they go
      for (const l of logs) {
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.rotate(l.angle);
        const char = 1 - l.fuel;
        ctx.fillStyle = `rgb(${Math.round(74 - char * 40)}, ${Math.round(52 - char * 30)}, ${Math.round(36 - char * 22)})`;
        ctx.beginPath();
        ctx.roundRect(-l.len / 2, -11, l.len, 22, 8);
        ctx.fill();
        // the ends glow while there is fuel left
        if (l.fuel > 0.02) {
          ctx.fillStyle = `rgba(255, 130, 50, ${0.35 * l.fuel})`;
          ctx.beginPath();
          ctx.roundRect(-l.len / 2 + 5, -7, l.len - 10, 14, 6);
          ctx.fill();
        }
        ctx.restore();
      }

      // flames rise from the logs themselves
      ctx.globalCompositeOperation = "lighter";
      for (const l of logs) {
        if (l.fuel <= 0.02) continue;
        const tongues = Math.ceil(3 + l.fuel * 5);
        for (let i = 0; i < tongues; i++) {
          const along = (i / (tongues - 1 || 1) - 0.5) * l.len * 0.7;
          const bx = l.x + Math.cos(l.angle) * along;
          const by = l.y + Math.sin(l.angle) * along - 8;
          const wob = Math.sin(now / 180 + i * 2.1 + l.x) * 12;
          const tall = (44 + l.fuel * 90) * (0.7 + Math.sin(now / 130 + i) * 0.3);
          const flame = ctx.createRadialGradient(bx, by - tall * 0.3, 2, bx + wob * 0.4, by - tall * 0.4, tall * 0.72);
          flame.addColorStop(0, `rgba(255, 220, 150, ${0.5 * l.fuel})`);
          flame.addColorStop(0.4, `rgba(255, 132, 40, ${0.28 * l.fuel})`);
          flame.addColorStop(1, "rgba(140, 30, 0, 0)");
          ctx.fillStyle = flame;
          ctx.beginPath();
          ctx.ellipse(bx + wob * 0.3, by - tall * 0.42, 20 + l.fuel * 12, tall * 0.6, 0, 0, TAU);
          ctx.fill();
        }
      }

      // embers, lifted off the hot ones
      if (heat > 0.05 && Math.random() < heat * 0.4) {
        const l = logs[Math.floor(Math.random() * logs.length)];
        if (l && l.fuel > 0.05) {
          embers.push({
            x: l.x + (Math.random() - 0.5) * l.len * 0.6,
            y: l.y - 10,
            vx: (Math.random() - 0.5) * 22,
            vy: -40 - Math.random() * 70,
            life: 1,
            heat: l.fuel,
          });
        }
      }
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        e.life -= dt * 0.5;
        if (e.life <= 0) {
          embers.splice(i, 1);
          continue;
        }
        e.vy += 6 * dt;
        e.vx += Math.sin(now / 300 + e.y) * 6 * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        ctx.fillStyle = `rgba(255, ${Math.round(120 + e.life * 90)}, 60, ${e.life * 0.8})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 1.4 * e.life + 0.4, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      closeAudio();
    };
  }, []);

  return (
    <div className={s.stage}>
      <canvas ref={canvasRef} className={s.canvas} />
      <div className={s.controls}>
        <button className={s.button} onClick={addLog}>
          add a log
        </button>
        <span className={s.count}>{count === 1 ? "1 log" : `${count} logs`}</span>
      </div>
    </div>
  );
}
