"use client";

import { useEffect, useRef } from "react";
import { click as tick, closeAudio } from "@/lib/audio";

const TAU = Math.PI * 2;
const RX = 74;
const RY = 98;
/** Cracks before it gives up. */
const LIMIT = 7;

interface Crack {
  points: { x: number; y: number }[];
  drawn: number;
}

interface Shard {
  poly: { x: number; y: number }[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  settled: boolean;
}

/** The egg outline, in egg-local coordinates. */
function shell(t: number) {
  return {
    x: RX * Math.cos(t) * (1 - 0.2 * Math.sin(t)),
    y: -RY * Math.sin(t),
  };
}

/**
 * 005 — EGG
 *
 * One egg. You can click it. It cracks. Eventually it breaks, and nothing
 * comes out, because there was never anything in it. Refresh for another
 * egg, which will also contain nothing.
 */
export default function Egg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = width / 2;
      cy = height / 2;
    };
    resize();
    window.addEventListener("resize", resize);

    const cracks: Crack[] = [];
    const shards: Shard[] = [];
    let broken = false;
    let wobble = 0;
    let wobbleAt = 0;

    /** A jagged line wandering across the shell from a random edge point. */
    const makeCrack = (): Crack => {
      const t = Math.random() * TAU;
      const start = shell(t);
      const points = [start];
      let px = start.x;
      let py = start.y;
      // walk inward, roughly toward the middle, wandering as it goes
      const steps = 4 + Math.floor(Math.random() * 4);
      let angle = Math.atan2(-py, -px) + (Math.random() - 0.5) * 0.9;
      for (let i = 0; i < steps; i++) {
        const len = 12 + Math.random() * 18;
        angle += (Math.random() - 0.5) * 1.5;
        px += Math.cos(angle) * len;
        py += Math.sin(angle) * len;
        points.push({ x: px, y: py });
      }
      return { points, drawn: 0 };
    };

    const shatter = () => {
      broken = true;
      const pieces = 9;
      for (let i = 0; i < pieces; i++) {
        const a0 = (i / pieces) * TAU;
        const a1 = ((i + 1) / pieces) * TAU;
        const poly = [{ x: 0, y: 0 }];
        for (let k = 0; k <= 4; k++) {
          poly.push(shell(a0 + ((a1 - a0) * k) / 4));
        }
        const mid = shell((a0 + a1) / 2);
        shards.push({
          poly,
          x: cx,
          y: cy,
          vx: mid.x * 0.035 + (Math.random() - 0.5) * 0.6,
          vy: -1.4 - Math.random() * 1.6,
          rot: 0,
          spin: (Math.random() - 0.5) * 0.09,
          settled: false,
        });
      }
      tick({ freq: 700, gain: 0.34, decay: 0.16, q: 0.6 });
    };

    const hit = (x: number, y: number) => {
      if (broken) return;
      // only count clicks that actually land on the egg
      const dx = (x - cx) / RX;
      const dy = (y - cy) / RY;
      if (dx * dx + dy * dy > 1.15) return;

      cracks.push(makeCrack());
      wobble = 1;
      wobbleAt = performance.now();
      tick({ freq: 1800 + Math.random() * 900, gain: 0.22, decay: 0.05 });
      if (cracks.length >= LIMIT) shatter();
    };

    const onDown = (e: PointerEvent) => hit(e.clientX, e.clientY);
    canvas.addEventListener("pointerdown", onDown);

    let raf = 0;
    const frame = (now: number) => {
      ctx.clearRect(0, 0, width, height);

      const floor = cy + RY + 34;

      if (!broken) {
        // a small shudder each time it is struck
        const age = (now - wobbleAt) / 1000;
        wobble = Math.max(0, 1 - age * 3.4);
        const shake = Math.sin(age * 46) * wobble * 4;

        ctx.save();
        ctx.translate(cx + shake, cy);
        ctx.rotate(shake * 0.0022);

        shadow(ctx, floor - cy);
        eggBody(ctx);

        // cracks draw themselves on over a few frames
        ctx.strokeStyle = "rgba(60, 48, 38, 0.62)";
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        for (const crack of cracks) {
          crack.drawn = Math.min(crack.points.length, crack.drawn + 0.5);
          ctx.beginPath();
          ctx.moveTo(crack.points[0].x, crack.points[0].y);
          for (let i = 1; i < crack.drawn; i++) {
            ctx.lineTo(crack.points[i].x, crack.points[i].y);
          }
          ctx.stroke();
        }
        ctx.restore();
      } else {
        for (const sh of shards) {
          if (!sh.settled) {
            sh.vy += 0.34;
            sh.x += sh.vx;
            sh.y += sh.vy;
            sh.rot += sh.spin;
            if (sh.y > floor) {
              sh.y = floor;
              sh.vy *= -0.32;
              sh.vx *= 0.72;
              sh.spin *= 0.5;
              if (Math.abs(sh.vy) < 0.7) {
                sh.settled = true;
                sh.vy = 0;
                sh.spin = 0;
              }
            }
          }
          ctx.save();
          ctx.translate(sh.x, sh.y);
          ctx.rotate(sh.rot);
          ctx.beginPath();
          ctx.moveTo(sh.poly[0].x, sh.poly[0].y);
          for (const p of sh.poly.slice(1)) ctx.lineTo(p.x, p.y);
          ctx.closePath();
          ctx.fillStyle = "#efe7db";
          ctx.fill();
          ctx.strokeStyle = "rgba(60, 48, 38, 0.28)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }
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
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        cursor: "pointer",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}

function shadow(ctx: CanvasRenderingContext2D, dy: number) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.36)";
  ctx.beginPath();
  ctx.ellipse(0, dy, RX * 0.82, 9, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function eggBody(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(shell(0).x, shell(0).y);
  for (let t = 0.04; t < TAU; t += 0.04) {
    const p = shell(t);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();

  const grad = ctx.createRadialGradient(-RX * 0.35, -RY * 0.4, 8, 0, 0, RY * 1.25);
  grad.addColorStop(0, "#fdf8ef");
  grad.addColorStop(0.55, "#eee5d7");
  grad.addColorStop(1, "#cdc2b1");
  ctx.fillStyle = grad;
  ctx.fill();
}
