"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./snowfall.module.css";

interface Flake {
  x: number;
  y: number;
  vy: number;
  drift: number;
  r: number;
  phase: number;
}

/** A surface snow can pile on: the top edge of something on the page. */
interface Ledge {
  el: HTMLElement;
  x: number;
  y: number;
  w: number;
  /** Depth of snow across the ledge, one bucket per few pixels. */
  depth: number[];
}

const BUCKET = 6;

/**
 * 034 — SNOWFALL
 *
 * It is snowing on a webpage, and the page does not have special support
 * for being snowed on.
 *
 * Every element's top edge is measured and treated as a ledge. Flakes
 * that land settle into buckets across it, so drifts build up unevenly
 * and deeper where more has fallen. Nudge something and the snow on it
 * slides off, because it was only ever resting there.
 */
export default function Snowfall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const ledgesRef = useRef<Ledge[]>([]);
  const [nudged, setNudged] = useState(0);

  const measure = useCallback(() => {
    const page = pageRef.current;
    if (!page) return;
    const found: Ledge[] = [];
    page.querySelectorAll<HTMLElement>("[data-ledge]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 8) return;
      found.push({
        el,
        x: r.left,
        y: r.top,
        w: r.width,
        depth: new Array(Math.max(1, Math.ceil(r.width / BUCKET))).fill(0),
      });
    });
    // keep whatever snow was already lying, where the ledge still exists
    const before = ledgesRef.current;
    for (const ledge of found) {
      const old = before.find((b) => b.el === ledge.el);
      if (old) {
        for (let i = 0; i < ledge.depth.length; i++) {
          ledge.depth[i] = old.depth[Math.min(i, old.depth.length - 1)] ?? 0;
        }
      }
    }
    ledgesRef.current = found;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const flakes: Flake[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      measure();
    };
    resize();
    window.addEventListener("resize", resize);

    const seed = (y?: number) => ({
      x: Math.random() * width,
      y: y ?? -10 - Math.random() * height,
      vy: 22 + Math.random() * 40,
      drift: (Math.random() - 0.5) * 22,
      r: 1 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
    });
    for (let i = 0; i < 320; i++) flakes.push(seed(Math.random() * height));

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const ledges = ledgesRef.current;
      ctx.clearRect(0, 0, width, height);

      for (const f of flakes) {
        f.phase += dt * 1.4;
        f.y += f.vy * dt;
        f.x += (f.drift + Math.sin(f.phase) * 12) * dt;

        // has it landed on anything?
        let landed = false;
        for (const ledge of ledges) {
          if (f.x < ledge.x || f.x > ledge.x + ledge.w) continue;
          const bucket = Math.min(
            ledge.depth.length - 1,
            Math.max(0, Math.floor((f.x - ledge.x) / BUCKET)),
          );
          const top = ledge.y - ledge.depth[bucket];
          if (f.y >= top && f.y < top + 26) {
            ledge.depth[bucket] += 0.5;
            // snow slumps sideways rather than building towers
            const left = ledge.depth[bucket - 1];
            const right = ledge.depth[bucket + 1];
            if (left !== undefined && ledge.depth[bucket] - left > 3) {
              ledge.depth[bucket] -= 1;
              ledge.depth[bucket - 1] += 1;
            } else if (right !== undefined && ledge.depth[bucket] - right > 3) {
              ledge.depth[bucket] -= 1;
              ledge.depth[bucket + 1] += 1;
            }
            landed = true;
            break;
          }
        }

        if (landed || f.y > height + 10 || f.x < -20 || f.x > width + 20) {
          Object.assign(f, seed());
        }
      }

      // the drifts
      ctx.fillStyle = "#e8eef4";
      for (const ledge of ledges) {
        ctx.beginPath();
        ctx.moveTo(ledge.x, ledge.y + 1);
        for (let i = 0; i < ledge.depth.length; i++) {
          ctx.lineTo(ledge.x + i * BUCKET, ledge.y - ledge.depth[i]);
        }
        ctx.lineTo(ledge.x + ledge.w, ledge.y + 1);
        ctx.closePath();
        ctx.fill();
      }

      // and the weather
      ctx.fillStyle = "rgba(240, 246, 252, 0.85)";
      for (const f of flakes) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [measure]);

  /** Shove everything about, so the snow has to fall off. */
  const nudge = useCallback(() => {
    const page = pageRef.current;
    if (!page) return;
    page.querySelectorAll<HTMLElement>("[data-ledge]").forEach((el) => {
      el.style.transform = `translate(${(Math.random() - 0.5) * 40}px, ${(Math.random() - 0.5) * 26}px) rotate(${(Math.random() - 0.5) * 5}deg)`;
    });
    // the snow was only resting there
    ledgesRef.current.forEach((l) => l.depth.fill(0));
    setNudged((n) => n + 1);
    window.setTimeout(measure, 420);
  }, [measure]);

  return (
    <div className={s.stage}>
      <div className={s.page} ref={pageRef}>
        <h1 className={s.title} data-ledge>
          It is snowing indoors
        </h1>
        <p className={s.copy} data-ledge>
          Nothing on this page was built to be snowed on. The snow does not
          know that, and is settling on it anyway.
        </p>
        <div className={s.row}>
          <span className={s.card} data-ledge>
            a shelf
          </span>
          <span className={s.card} data-ledge>
            another shelf
          </span>
          <span className={s.card} data-ledge>
            a third
          </span>
        </div>
        <div className={s.row}>
          <span className={s.bar} data-ledge />
          <span className={s.bar} data-ledge />
        </div>
        <button className={s.nudge} onClick={nudge}>
          {nudged === 0 ? "nudge everything" : "nudge it again"}
        </button>
      </div>

      <canvas ref={canvasRef} className={s.canvas} />
    </div>
  );
}
