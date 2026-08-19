"use client";

import { useEffect, useRef } from "react";
import { closeAudio, getAudio } from "@/lib/audio";

const TAU = Math.PI * 2;

interface Drop {
  x: number;
  y: number;
  r: number;
  vy: number;
  /** Sliding drops leave a thinning trail behind them. */
  streak: boolean;
}

/**
 * 006 — RAIN MACHINE
 *
 * The browser becomes a window on a wet night. Droplets bead on the
 * glass, gather weight, and once they are heavy enough they let go and
 * run — swallowing whatever they touch on the way down and leaving a
 * trail that the next drop can follow.
 *
 * Push the cursor across the glass to shove them around. Click for
 * lightning.
 */
export default function RainMachine() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let lights: { x: number; y: number; r: number; hue: string }[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // the city behind the glass, permanently out of focus
      const palette = ["#c98a4e", "#8fb2c9", "#d8b26a", "#6f8fa8", "#e0a06a"];
      lights = Array.from({ length: 26 }, () => ({
        x: Math.random() * width,
        y: height * 0.25 + Math.random() * height * 0.7,
        r: 26 + Math.random() * 90,
        hue: palette[Math.floor(Math.random() * palette.length)],
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    let drops: Drop[] = [];
    const mouse = { x: -999, y: -999 };
    let flash = 0;

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = () => {
      mouse.x = -999;
      mouse.y = -999;
    };

    /** A distant strike: light first, then the rumble catches up. */
    const strike = () => {
      flash = 1;
      const ac = getAudio();
      if (!ac) return;
      const now = ac.currentTime;
      const delay = 0.35 + Math.random() * 0.5;
      const dur = 1.6;

      const frames = Math.ceil(ac.sampleRate * dur);
      const buffer = ac.createBuffer(1, frames, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 1.6;
      }
      const src = ac.createBufferSource();
      src.buffer = buffer;
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 260;
      const amp = ac.createGain();
      amp.gain.value = 0.4;
      src.connect(lp).connect(amp).connect(ac.destination);
      src.start(now + delay);
      src.stop(now + delay + dur);
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", strike);

    let raf = 0;
    const frame = () => {
      // --- the world outside, blurred ------------------------------
      ctx.fillStyle = "#0d0d0d";
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.filter = "blur(26px)";
      for (const l of lights) {
        const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
        g.addColorStop(0, l.hue);
        g.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.38;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.filter = "none";

      if (flash > 0) {
        ctx.fillStyle = `rgba(198, 214, 236, ${flash * 0.5})`;
        ctx.fillRect(0, 0, width, height);
        flash -= 0.045;
      }

      // --- condensation --------------------------------------------
      for (let i = 0; i < 3; i++) {
        drops.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 1 + Math.random() * 2.2,
          vy: 0,
          streak: false,
        });
      }

      for (const d of drops) {
        // the cursor shoves nearby beads and knocks them loose
        const mdx = d.x - mouse.x;
        const mdy = d.y - mouse.y;
        const md = Math.hypot(mdx, mdy);
        if (md < 74) {
          d.x += (mdx / (md || 1)) * 1.6;
          d.y += (mdy / (md || 1)) * 0.9;
          if (d.r > 2.6) d.vy = Math.max(d.vy, 0.9);
        }

        // weight decides whether it holds on
        if (d.r > 3.6) {
          d.vy += 0.055 * (d.r / 5);
          d.vy *= 0.985;
          d.y += d.vy;
          d.streak = d.vy > 0.5;
          // stuttering, the way real drops catch on the glass
          if (Math.random() < 0.04) d.vy *= 0.4;
          if (d.streak && Math.random() < 0.55) {
            drops.push({ x: d.x + (Math.random() - 0.5) * 1.6, y: d.y - d.r, r: d.r * 0.22, vy: 0, streak: false });
            d.r *= 0.996;
          }
        }
      }

      // bigger drops swallow whatever they run into
      drops.sort((a, b) => b.r - a.r);
      for (let i = 0; i < drops.length; i++) {
        const a = drops[i];
        if (a.r <= 0) continue;
        for (let j = i + 1; j < drops.length; j++) {
          const b = drops[j];
          if (b.r <= 0) continue;
          if (Math.abs(a.x - b.x) > a.r + b.r) continue;
          if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r * 0.6) {
            a.r = Math.sqrt(a.r * a.r + b.r * b.r);
            b.r = 0;
          }
        }
      }

      drops = drops.filter((d) => d.r > 0.3 && d.y < height + 20).slice(0, 1400);

      // --- draw the glass ------------------------------------------
      for (const d of drops) {
        const g = ctx.createRadialGradient(
          d.x - d.r * 0.35,
          d.y - d.r * 0.4,
          d.r * 0.1,
          d.x,
          d.y,
          d.r,
        );
        g.addColorStop(0, "rgba(226, 238, 250, 0.72)");
        g.addColorStop(0.55, "rgba(150, 178, 202, 0.24)");
        g.addColorStop(1, "rgba(13, 13, 13, 0.45)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, TAU);
        ctx.fill();

        if (d.r > 2.4) {
          ctx.fillStyle = "rgba(240, 248, 255, 0.5)";
          ctx.beginPath();
          ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.36, d.r * 0.22, 0, TAU);
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", strike);
      closeAudio();
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, cursor: "crosshair" }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
