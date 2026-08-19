"use client";

import { useEffect, useRef } from "react";

const TAU = Math.PI * 2;

interface Eye {
  x: number;
  y: number;
  r: number;
  /** Each eye blinks on its own schedule. */
  blink: number;
  next: number;
  lookX: number;
  lookY: number;
}

/**
 * 012 — EYEBALLS
 *
 * A wall of eyes. They all follow the cursor, at slightly different
 * speeds, so the crowd never quite moves as one. Take the cursor off the
 * page and they keep staring at the spot where it left.
 */
export default function Eyeballs() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let eyes: Eye[] = [];

    const build = () => {
      eyes = [];
      const pitch = 96;
      const cols = Math.ceil(width / pitch);
      const rows = Math.ceil(height / pitch);
      const padX = (width - (cols - 1) * pitch) / 2;
      const padY = (height - (rows - 1) * pitch) / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          eyes.push({
            x: padX + c * pitch + (Math.random() - 0.5) * 14,
            y: padY + r * pitch + (Math.random() - 0.5) * 14,
            r: 18 + Math.random() * 11,
            blink: 0,
            next: 1.5 + Math.random() * 6,
            lookX: 0,
            lookY: 0,
          });
        }
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };
    resize();
    window.addEventListener("resize", resize);

    // Starts in the middle, and stays wherever the cursor was last seen.
    const target = { x: width / 2, y: height / 2 };
    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
    };
    window.addEventListener("pointermove", onMove);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      ctx.clearRect(0, 0, width, height);

      for (const eye of eyes) {
        eye.next -= dt;
        if (eye.next < 0) {
          eye.blink = 0.16;
          eye.next = 2 + Math.random() * 7;
        }
        if (eye.blink > 0) eye.blink -= dt;

        // each eye catches up at its own rate, so they never move as one
        const dx = target.x - eye.x;
        const dy = target.y - eye.y;
        const dist = Math.hypot(dx, dy) || 1;
        const reach = Math.min(eye.r * 0.32, dist * 0.5);
        const ease = Math.min(1, dt * (5 + (eye.r % 5)));
        eye.lookX += ((dx / dist) * reach - eye.lookX) * ease;
        eye.lookY += ((dy / dist) * reach - eye.lookY) * ease;

        // sclera
        ctx.fillStyle = "#e8e3d9";
        ctx.beginPath();
        ctx.ellipse(eye.x, eye.y, eye.r, eye.r * 0.72, 0, 0, TAU);
        ctx.fill();

        if (eye.blink > 0) {
          // lid comes down over the whole eye
          ctx.fillStyle = "#0d0d0d";
          ctx.beginPath();
          ctx.ellipse(eye.x, eye.y, eye.r + 1, eye.r * 0.72 + 1, 0, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = "#8c8378";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(eye.x - eye.r, eye.y);
          ctx.lineTo(eye.x + eye.r, eye.y);
          ctx.stroke();
          continue;
        }

        ctx.fillStyle = "#5b4a38";
        ctx.beginPath();
        ctx.arc(eye.x + eye.lookX, eye.y + eye.lookY, eye.r * 0.42, 0, TAU);
        ctx.fill();

        ctx.fillStyle = "#120e0a";
        ctx.beginPath();
        ctx.arc(eye.x + eye.lookX, eye.y + eye.lookY, eye.r * 0.21, 0, TAU);
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath();
        ctx.arc(
          eye.x + eye.lookX - eye.r * 0.13,
          eye.y + eye.lookY - eye.r * 0.14,
          eye.r * 0.07,
          0,
          TAU,
        );
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
