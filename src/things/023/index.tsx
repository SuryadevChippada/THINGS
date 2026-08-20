"use client";

import { useEffect, useRef, useState } from "react";

interface Grave {
  x: number;
  y: number;
  time: string;
  /** How long the cursor lay there, which decides the size of the stone. */
  rest: number;
  born: number;
  seed: number;
}

/**
 * 023 — CURSOR CEMETERY
 *
 * Whenever the cursor stops long enough, it is buried where it fell. The
 * longer it rested, the bigger the stone.
 *
 * Leave the page open and come back to it: the cemetery is a record of
 * everywhere you paused, which turns out to be a fairly honest picture of
 * how you use a screen.
 */
export default function CursorCemetery() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(0);

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

    const graves: Grave[] = [];
    const cursor = { x: -999, y: -999 };
    let stillFor = 0;
    let buried = false;

    const onMove = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - cursor.x, e.clientY - cursor.y) > 6) {
        stillFor = 0;
        buried = false;
      }
      cursor.x = e.clientX;
      cursor.y = e.clientY;
    };
    window.addEventListener("pointermove", onMove);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (cursor.x > -100) {
        stillFor += dt;
        // it has to lie there a moment before anyone declares it
        if (!buried && stillFor > 1.4) {
          buried = true;
          const at = new Date();
          graves.push({
            x: cursor.x,
            y: cursor.y,
            time: [at.getHours(), at.getMinutes(), at.getSeconds()]
              .map((n) => String(n).padStart(2, "0"))
              .join(":"),
            rest: 0,
            born: 0,
            seed: Math.random(),
          });
          setCount(graves.length);
        }
        // a stone keeps growing while the cursor stays put
        if (buried && graves.length) graves[graves.length - 1].rest += dt;
      }

      ctx.clearRect(0, 0, width, height);

      // ground fog, so the older stones sit further back
      const fog = ctx.createLinearGradient(0, height * 0.4, 0, height);
      fog.addColorStop(0, "rgba(214, 209, 201, 0)");
      fog.addColorStop(1, "rgba(214, 209, 201, 0.035)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, height * 0.4, width, height * 0.6);

      for (const g of graves) {
        g.born = Math.min(1, g.born + dt * 1.6);
        drawGrave(ctx, g);
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
      <span
        style={{
          position: "fixed",
          bottom: "clamp(1.25rem, 3vw, 2rem)",
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          fontSize: "0.6rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
          pointerEvents: "none",
        }}
      >
        {count === 0
          ? "keep still"
          : count === 1
            ? "1 resting here"
            : `${count} resting here`}
      </span>
    </div>
  );
}

function drawGrave(ctx: CanvasRenderingContext2D, g: Grave) {
  const size = (11 + Math.min(18, g.rest * 2.4)) * g.born;
  if (size <= 0) return;

  ctx.save();
  ctx.translate(g.x, g.y);
  // stones settle at a slight angle, as they do
  ctx.rotate((g.seed - 0.5) * 0.14);
  ctx.globalAlpha = 0.28 + g.born * 0.42;

  // the plot
  ctx.fillStyle = "rgba(214, 209, 201, 0.05)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.55, size * 0.85, size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // the headstone: a rounded slab
  ctx.fillStyle = "#4a4642";
  ctx.beginPath();
  ctx.moveTo(-size * 0.44, size * 0.5);
  ctx.lineTo(-size * 0.44, -size * 0.15);
  ctx.arc(0, -size * 0.15, size * 0.44, Math.PI, 0);
  ctx.lineTo(size * 0.44, size * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(214, 209, 201, 0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // the cross, and the hour it stopped
  ctx.fillStyle = "rgba(214, 209, 201, 0.55)";
  ctx.font = `${Math.max(7, size * 0.34)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.fillText("†", 0, -size * 0.1);

  if (size > 15) {
    ctx.fillStyle = "rgba(214, 209, 201, 0.34)";
    ctx.font = `${Math.max(6, size * 0.2)}px ui-monospace, monospace`;
    ctx.fillText(g.time, 0, size * 0.3);
  }

  ctx.restore();
}
