"use client";

import { useEffect, useRef, useState } from "react";

const TAU = Math.PI * 2;

/**
 * 053 — DON'T WAKE HIM
 *
 * Somebody is asleep. The faster you move the cursor, the more noise you
 * make, and the noise builds up.
 *
 * It does not reset when you stop — it drains, slowly, so a single sharp
 * movement can undo a minute of creeping. He stirs before he wakes, which
 * is your only warning, and the correct response to it is to stop
 * entirely rather than to keep going carefully.
 */
export default function DontWakeHim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [awake, setAwake] = useState(false);

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

    const cursor = { x: -999, y: -999, lastX: -999, lastY: -999 };
    /** 0 is silence, 1 is he is sitting up looking at you. */
    let noise = 0;
    let woke = false;
    let stir = 0;

    const onMove = (e: PointerEvent) => {
      if (cursor.lastX > -100) {
        const moved = Math.hypot(e.clientX - cursor.lastX, e.clientY - cursor.lastY);
        // noise goes up with the square of how fast you moved
        noise = Math.min(1.4, noise + (moved * moved) / 26000);
      }
      cursor.lastX = e.clientX;
      cursor.lastY = e.clientY;
      cursor.x = e.clientX;
      cursor.y = e.clientY;
    };
    window.addEventListener("pointermove", onMove);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // silence is slow to earn
      noise = Math.max(0, noise - dt * 0.12);
      if (noise > 1 && !woke) {
        woke = true;
        setAwake(true);
      }
      if (woke) stir = Math.min(1, stir + dt * 1.6);
      else stir = Math.max(0, stir - dt * 0.8);

      const cx = width / 2;
      const cy = height / 2 + 30;
      const breath = Math.sin(now / (woke ? 900 : 2600));

      ctx.clearRect(0, 0, width, height);

      // the room, dark and getting lighter as he stirs
      const glow = ctx.createRadialGradient(cx, cy - 40, 40, cx, cy, 460);
      glow.addColorStop(0, `rgba(70, 78, 96, ${0.16 + noise * 0.1})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      // bed
      ctx.fillStyle = "#232733";
      ctx.beginPath();
      ctx.roundRect(cx - 210, cy - 40, 420, 130, 12);
      ctx.fill();

      // him, under the covers
      ctx.save();
      ctx.translate(cx, cy);
      // he shifts about as it gets noisier
      ctx.rotate(Math.sin(now / 340) * noise * 0.03);

      // the duvet, rising and falling
      ctx.fillStyle = "#39405a";
      ctx.beginPath();
      ctx.ellipse(20, 26 + breath * (woke ? 1 : 2), 150, 42, 0, 0, TAU);
      ctx.fill();

      // pillow
      ctx.fillStyle = "#c9c3b6";
      ctx.beginPath();
      ctx.roundRect(-190, -4, 96, 46, 14);
      ctx.fill();

      // head
      ctx.fillStyle = "#d8b79a";
      ctx.beginPath();
      ctx.arc(-140, 12 - stir * 34, 30, 0, TAU);
      ctx.fill();

      // hair
      ctx.fillStyle = "#3b2f27";
      ctx.beginPath();
      ctx.arc(-146, 4 - stir * 34, 28, Math.PI * 0.95, TAU * 0.98);
      ctx.fill();

      // eyes: closed, then open
      ctx.strokeStyle = "#3b2f27";
      ctx.lineWidth = 2;
      if (stir < 0.6) {
        for (const ex of [-152, -130]) {
          ctx.beginPath();
          ctx.arc(ex, 14 - stir * 34, 5, 0.15 * Math.PI, 0.85 * Math.PI);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = "#f2efe8";
        for (const ex of [-152, -130]) {
          ctx.beginPath();
          ctx.arc(ex, 12 - stir * 34, 5.5, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = "#1a1512";
        for (const ex of [-152, -130]) {
          ctx.beginPath();
          ctx.arc(ex + 1.5, 12 - stir * 34, 2.4, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();

      // the z's, while he is still under
      if (!woke) {
        ctx.fillStyle = `rgba(214,209,201,${0.3 * (1 - noise)})`;
        ctx.font = "600 15px ui-monospace, monospace";
        for (let i = 0; i < 3; i++) {
          const p = (now / 2400 + i * 0.33) % 1;
          ctx.globalAlpha = 0.4 * (1 - p) * (1 - Math.min(1, noise));
          ctx.fillText("z", cx - 96 + p * 26, cy - 34 - p * 46);
        }
        ctx.globalAlpha = 1;
      }

      // the noise meter, which is the whole interface
      const barW = 220;
      ctx.fillStyle = "rgba(214,209,201,0.1)";
      ctx.fillRect(cx - barW / 2, height - 90, barW, 3);
      ctx.fillStyle = noise > 0.72 ? "#e0653f" : "#c9875c";
      ctx.fillRect(cx - barW / 2, height - 90, Math.min(barW, noise * barW), 3);

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
    <div style={{ position: "fixed", inset: 0, cursor: "crosshair" }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
      <span
        style={{
          position: "fixed",
          bottom: "clamp(1.25rem, 3vw, 2rem)",
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          fontSize: "0.6rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: awake ? "var(--accent)" : "var(--text-dim)",
          pointerEvents: "none",
        }}
      >
        {awake ? "well done" : "move slowly"}
      </span>
    </div>
  );
}
